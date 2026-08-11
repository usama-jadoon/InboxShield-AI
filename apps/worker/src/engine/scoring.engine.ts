import { EngineOrchestrator, DnsScanner, SpfScanner, DkimScanner, DmarcScanner, MxScanner, TlsScanner, BlacklistScanner, IpBlacklistScanner } from '@inboxshield/engine';

/**
 * Canonical engine-backed scoring (V1-07).
 *
 * Replaces the previous custom ScoringEngine with a thin adapter around
 * @inboxshield/engine's EngineOrchestrator. This guarantees the worker and
 * the web API both use identical scanner logic and deterministic scoring.
 *
 * The engine returns ScannerResult with { passed: true | false | null, scoreWeight, flags }.
 * We map this to the worker's legacy DomainHealthReport shape for compatibility.
 */
export interface DomainHealthReport {
  domain: string;
  timestamp: string;
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: {
    spf: { passed: boolean; message: string };
    dkim: { passed: boolean; message: string };
    dmarc: { passed: boolean; policy: string | null; message: string };
    mx: { passed: boolean; message: string };
    blacklist: { isListed: boolean; listedOn: string[] };
  };
  recommendations: string[];
}

function mapScannerResult(result: import('@inboxshield/engine').ScannerResult | undefined, defaultMessage: string): { passed: boolean; message: string } {
  if (!result) return { passed: false, message: defaultMessage };
  return {
    passed: result.passed === true,
    message: result.error ?? (result.passed === true ? 'Valid' : result.flags.join(', ') || defaultMessage)
  };
}

function mapDmarcResult(result: import('@inboxshield/engine').ScannerResult | undefined): { passed: boolean; policy: string | null; message: string } {
  if (!result) return { passed: false, policy: null, message: 'No DMARC result' };
  const raw = result.rawData as string | null;
  const policyMatch = raw?.match(/p=(\w+)/);
  const policy = policyMatch ? policyMatch[1] : null;
  return {
    passed: result.passed === true,
    policy,
    message: result.error ?? (result.passed === true ? `Valid policy: p=${policy}` : 'Invalid DMARC')
  };
}

function mapMxResult(result: import('@inboxshield/engine').ScannerResult | undefined): { passed: boolean; message: string } {
  if (!result) return { passed: false, message: 'No MX result' };
  const records = Array.isArray(result.rawData) ? result.rawData : [];
  return {
    passed: result.passed === true,
    message: result.error ?? (result.passed === true ? `${records.length} MX records found.` : 'Invalid MX')
  };
}

function mapBlacklistResult(result: import('@inboxshield/engine').ScannerResult | undefined): { isListed: boolean; listedOn: string[] } {
  if (!result) return { isListed: false, listedOn: [] };
  const listed = result.rawData as string[] | undefined;
  return {
    isListed: result.passed === false, // engine: passed=false means LISTED
    listedOn: listed ?? []
  };
}

export class ScoringEngine {
  private static orchestrator: EngineOrchestrator | null = null;

  private static getOrchestrator(): EngineOrchestrator {
    if (!this.orchestrator) {
      const o = new EngineOrchestrator();
      o.registerScanner(new DnsScanner());
      o.registerScanner(new SpfScanner());
      o.registerScanner(new DkimScanner());
      o.registerScanner(new DmarcScanner());
      o.registerScanner(new MxScanner());
      o.registerScanner(new TlsScanner());
      o.registerScanner(new BlacklistScanner());
      o.registerScanner(new IpBlacklistScanner());
      this.orchestrator = o;
    }
    return this.orchestrator;
  }

  /**
   * Generates a comprehensive health report for a domain using the
   * canonical @inboxshield/engine orchestrator.
   */
  static async evaluateDomain(domain: string): Promise<DomainHealthReport> {
    const orchestrator = this.getOrchestrator();
    const report = await orchestrator.analyzeDomain(domain);

    const spf = mapScannerResult(report.scannerResults['auth:spf'], 'No SPF result');
    const dkim = mapScannerResult(report.scannerResults['auth:dkim'], 'No DKIM result');
    const dmarc = mapDmarcResult(report.scannerResults['auth:dmarc']);
    const mx = mapMxResult(report.scannerResults['network:mx']);
    const blacklist = mapBlacklistResult(report.scannerResults['network:blacklist:domain']);

    const recommendations: string[] = [];
    if (!spf.passed) recommendations.push('Fix SPF record: ' + spf.message);
    if (!dkim.passed) recommendations.push('Fix DKIM record: ' + dkim.message);
    if (!dmarc.passed) recommendations.push('Implement strict DMARC policy: ' + dmarc.message);
    if (!mx.passed) recommendations.push('Configure MX records to receive bounce messages.');
    if (blacklist.isListed) recommendations.push(`Delist domain from blacklists immediately: ${blacklist.listedOn.join(', ')}`);

    return {
      domain: report.domain,
      timestamp: report.timestamp,
      score: report.globalScore,
      riskLevel: report.riskLevel,
      details: { spf, dkim, dmarc, mx, blacklist },
      recommendations
    };
  }
}