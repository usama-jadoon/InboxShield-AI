import { SpfScanner } from "../scanners/spf.scanner";
import { DkimScanner } from "../scanners/dkim.scanner";
import { DmarcScanner } from "../scanners/dmarc.scanner";
import { MxScanner } from "../scanners/mx.scanner";
import { BlacklistScanner } from "../scanners/blacklist.scanner";

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

export class ScoringEngine {
  /**
   * Generates a comprehensive health report for a domain.
   */
  static async evaluateDomain(domain: string, dkimSelector?: string): Promise<DomainHealthReport> {
    const [spf, dkim, dmarc, mx, blacklist] = await Promise.all([
      SpfScanner.verify(domain),
      dkimSelector ? DkimScanner.verify(domain, dkimSelector) : Promise.resolve({ passed: false, record: null, error: "Selector missing" }),
      DmarcScanner.verify(domain),
      MxScanner.verify(domain),
      BlacklistScanner.checkDomain(domain)
    ]);

    let score = 100;
    const recommendations: string[] = [];

    // Scoring logic (Penalty based)
    if (!spf.passed) {
      score -= 20;
      recommendations.push("Fix SPF record: " + spf.error);
    }

    if (!dkim.passed) {
      score -= 20;
      recommendations.push("Fix DKIM record: " + dkim.error);
    }

    if (!dmarc.passed) {
      score -= 30; // DMARC is critical for modern inbox placement
      recommendations.push("Implement strict DMARC policy: " + dmarc.error);
    } else if (dmarc.policy === 'none') {
      score -= 10;
      recommendations.push("Upgrade DMARC policy from 'none' to 'quarantine' or 'reject'.");
    }

    if (!mx.passed) {
      score -= 15;
      recommendations.push("Configure MX records to receive bounce messages.");
    }

    if (blacklist.isListed) {
      score -= 50; // Instant heavy penalty
      recommendations.push(`Delist domain from blacklists immediately: ${blacklist.listedOn.join(', ')}`);
    }

    // Floor score at 0
    score = Math.max(0, score);

    // Risk Mapping
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (score < 40) riskLevel = 'CRITICAL';
    else if (score < 70) riskLevel = 'HIGH';
    else if (score < 90) riskLevel = 'MEDIUM';

    return {
      domain,
      timestamp: new Date().toISOString(),
      score,
      riskLevel,
      details: {
        spf: { passed: spf.passed, message: spf.error || `Valid: ${spf.record}` },
        dkim: { passed: dkim.passed, message: dkim.error || 'Valid DKIM configured.' },
        dmarc: { passed: dmarc.passed, policy: dmarc.policy, message: dmarc.error || `Valid policy: p=${dmarc.policy}` },
        mx: { passed: mx.passed, message: mx.error || `${mx.records?.length || 0} MX records found.` },
        blacklist: { isListed: blacklist.isListed, listedOn: blacklist.listedOn }
      },
      recommendations
    };
  }
}
