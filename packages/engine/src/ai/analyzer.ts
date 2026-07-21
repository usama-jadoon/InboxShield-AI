import { EngineReport } from '../core/types';

export interface AiRecommendation {
  issue: string;
  recommendation: string;
  technicalDetails?: string;
}

export class AiAnalyzerStub {
  /**
   * Translates the structured Scanner Report flags into human-readable steps.
   * Note: In V1, this acts as a heuristic mapping. In future iterations, 
   * this interfaces directly with the OpenAI/Anthropic API securely.
   */
  static analyze(report: EngineReport): AiRecommendation[] {
    const recommendations: AiRecommendation[] = [];

    // Map through structural flags
    if (report.scannerResults['auth:spf']?.flags.includes('MISSING_SPF')) {
      recommendations.push({
        issue: 'Missing SPF Record',
        recommendation: 'You need to authorize the exact IP addresses sending email on your behalf.',
        technicalDetails: 'Add a TXT record at the root domain (`@`) with `v=spf1 include:_spf.google.com ~all` (adjusting the include based on your ESP).'
      });
    }

    if (report.scannerResults['auth:dmarc']?.flags.includes('MISSING_DMARC')) {
      recommendations.push({
        issue: 'Domain Spoofing Vulnerability (No DMARC)',
        recommendation: 'Without DMARC, anyone can pretend to send email as you. Major providers (Gmail/Yahoo) will block your emails completely.',
        technicalDetails: 'Create a TXT record at `_dmarc.yourdomain.com` with `v=DMARC1; p=quarantine;`'
      });
    }

    if (report.scannerResults['auth:dmarc']?.flags.includes('MONITORING_ONLY_DMARC')) {
      recommendations.push({
        issue: 'Weak DMARC Policy',
        recommendation: 'Your DMARC record is set to `p=none`. This is a monitoring mode only and provides zero physical spoofing protection.',
        technicalDetails: 'Update your `p=none` to `p=quarantine` or `p=reject` to start instructing ISPs to block unauthorized senders.'
      });
    }

    if (report.scannerResults['network:mx']?.flags.includes('MISSING_MX')) {
      recommendations.push({
        issue: 'Cannot Receive Replies (No MX)',
        recommendation: 'Your domain is not configured to receive email. ISPs look for bidirectional engagement to build your sender reputation. Without MX records, bounces will also fail to route back to you.',
        technicalDetails: 'Publish MX records pointing to a valid mail exchange server (e.g. Google Workspace or Microsoft 365).'
      });
    }
    
    if (report.scannerResults['network:blacklist:domain']?.flags.includes('DOMAIN_BLACKLISTED')) {
      recommendations.push({
        issue: 'Domain actively Blacklisted',
        recommendation: 'Your domain has been caught sending spam or hitting spam traps. You must immediately pause sending and request a delisting from the offending authority.',
        technicalDetails: `Check the exact listing authorities here: ${report.scannerResults['network:blacklist:domain'].error}`
      });
    }

    return recommendations;
  }
}
