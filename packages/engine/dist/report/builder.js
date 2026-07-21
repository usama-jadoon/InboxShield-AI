export class ReportBuilder {
    /**
     * Transforms raw engine and AI output into a strictly formatted, presentation-ready ReportModel.
     * This guarantees the Dashboard and PDF exporters share exact formatting logic, status labels, and color designations.
     */
    static build(report, recommendations) {
        const riskColorMap = {
            'LOW': 'emerald',
            'MEDIUM': 'amber',
            'HIGH': 'rose',
            'CRITICAL': 'rose'
        };
        const statusTextMap = {
            'LOW': 'Optimal Configuration',
            'MEDIUM': 'Action Recommended',
            'HIGH': 'Critical Vulnerabilities Detected',
            'CRITICAL': 'Active Deliverability Failure'
        };
        return {
            metadata: {
                domain: report.domain,
                generatedAt: report.timestamp,
                version: '1.0.0'
            },
            executiveSummary: {
                score: report.globalScore,
                riskLevel: report.riskLevel,
                statusText: statusTextMap[report.riskLevel],
                riskColor: riskColorMap[report.riskLevel]
            },
            authentication: this.buildAuthSections(report),
            infrastructure: this.buildInfraSections(report),
            recommendations,
            technicalAppendix: report.scannerResults // Dumping raw findings for deep technical inspection
        };
    }
    static mapResultToSection(title, result, fallbackDesc, successExtractor) {
        if (!result) {
            return {
                id: title.toLowerCase().replace(/\s/g, '-'),
                title,
                passed: false,
                statusLabel: 'SKIPPED',
                statusColor: 'neutral',
                description: 'Scan was not executed.',
                technicalDetail: 'N/A'
            };
        }
        let statusLabel = result.passed ? 'PASS' : 'FAIL';
        let statusColor = result.passed ? 'emerald' : 'rose';
        // Edge case evaluation based on flags
        if (result.flags.some((f) => f.includes('WARNING') || f.includes('SOON') || f.includes('MONITORING'))) {
            statusLabel = 'WARNING';
            statusColor = 'amber';
        }
        else if (result.flags.includes('SKIPPED') || result.flags.includes('SKIPPED_NO_MX')) {
            statusLabel = 'SKIPPED';
            statusColor = 'neutral';
        }
        return {
            id: result.scannerId,
            title,
            passed: result.passed,
            statusLabel,
            statusColor,
            description: result.passed ? successExtractor(result) : (result.error || fallbackDesc),
            technicalDetail: result.flags.length > 0 ? `Flags: ${result.flags.join(', ')}` : 'No flags raised.'
        };
    }
    static buildAuthSections(report) {
        return [
            this.mapResultToSection('Sender Policy Framework (SPF)', report.scannerResults['auth:spf'], 'Missing or invalid SPF record.', (r) => `Valid SPF Configuration: ${r.rawData || 'Authorized'}`),
            this.mapResultToSection('DomainKeys Identified Mail (DKIM)', report.scannerResults['auth:dkim'], 'Missing DKIM configuration.', (r) => { const obj = r; return `Valid DKIM. Selector: ${obj.rawData?.selector || 'Unknown'} (${obj.rawData?.type || 'rsa'})`; }),
            this.mapResultToSection('DMARC Enforcement', report.scannerResults['auth:dmarc'], 'Missing DMARC policy.', (r) => { const obj = r; return `Valid DMARC Configuration: ${obj.rawData}`; })
        ];
    }
    static buildInfraSections(report) {
        return [
            this.mapResultToSection('DNS Resolution (A/AAAA)', report.scannerResults['network:dns:a_record'], 'Domain failed to physically resolve.', () => 'Domain resolves via DNS successfully.'),
            this.mapResultToSection('Mail Exchange (MX)', report.scannerResults['network:mx'], 'Cannot receive email/bounces.', (r) => { const obj = r; return `${obj.rawData?.length || 0} active MX routes defined.`; }),
            this.mapResultToSection('SMTP & TLS Security', report.scannerResults['network:smtp:tls'], 'MX Server failed STARTTLS negotiation.', (r) => { const obj = r; return `Secured via ${obj.rawData?.protocol} (${obj.rawData?.cipher}). Cert valid for ${obj.rawData?.daysRemaining} days.`; }),
            this.mapResultToSection('Domain Blacklists (RBL/DBL)', report.scannerResults['network:blacklist:domain'], 'Domain is actively blacklisted.', () => 'Domain is clean across major blocklists.')
        ];
    }
}
