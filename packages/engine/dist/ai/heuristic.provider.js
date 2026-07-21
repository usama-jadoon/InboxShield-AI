export class HeuristicAiProvider {
    providerName = 'LocalHeuristicEngine';
    async analyze(report) {
        const recommendations = [];
        // SPF Checks
        if (report.scannerResults['auth:spf']?.flags.includes('MISSING_SPF')) {
            recommendations.push({
                issue: 'Missing SPF Record',
                recommendation: 'You need to authorize the specific servers sending email on your behalf.',
                technicalDetails: 'Add a TXT record at the root domain (`@`) with `v=spf1 include:_spf.example.com ~all`.'
            });
        }
        if (report.scannerResults['auth:spf']?.flags.includes('DUPLICATE_SPF')) {
            recommendations.push({
                issue: 'Duplicate SPF Records',
                recommendation: 'You have multiple SPF records. Email providers will fail your authentication due to ambiguity.',
                technicalDetails: 'Merge the includes into a single record. e.g., `v=spf1 include:_spf.google.com include:sendgrid.net ~all`'
            });
        }
        // DMARC Checks
        if (report.scannerResults['auth:dmarc']?.flags.includes('MISSING_DMARC')) {
            recommendations.push({
                issue: 'No DMARC published',
                recommendation: 'Major providers (Gmail/Yahoo) heavily penalize domains without DMARC. Your domain is currently vulnerable to spoofing.',
                technicalDetails: 'Publish a TXT record at `_dmarc` with `v=DMARC1; p=quarantine;`'
            });
        }
        if (report.scannerResults['auth:dmarc']?.flags.includes('MONITORING_ONLY_DMARC')) {
            recommendations.push({
                issue: 'Weak DMARC Policy (p=none)',
                recommendation: 'Your DMARC record is set to monitoring mode. This provides zero physical protection against domain spoofing.',
                technicalDetails: 'Update your DMARC record from `p=none` to `p=quarantine` or `p=reject`.'
            });
        }
        // DKIM Checks
        if (report.scannerResults['auth:dkim']?.flags.includes('DKIM_WEAK_KEY_SIZE_1024_OR_LESS')) {
            recommendations.push({
                issue: 'Weak DKIM Key Size',
                recommendation: 'Your DKIM key is 1024-bit or smaller. Modern security standards mandate 2048-bit keys to defend against cryptanalysis.',
                technicalDetails: 'Regenerate your DKIM keys within your ESP admin panel and update your DNS records.'
            });
        }
        // TLS Checks
        if (report.scannerResults['network:smtp:tls']?.flags.includes('CERT_EXPIRED')) {
            recommendations.push({
                issue: 'Mail Server TLS Expired',
                recommendation: 'The SSL/TLS certificate on your primary Mail Exchange server has expired. Mail will be delivered unencrypted or rejected.',
                technicalDetails: 'Renew the certificate on your MX host immediately.'
            });
        }
        if (report.scannerResults['network:smtp:tls']?.flags.includes('WEAK_TLS')) {
            recommendations.push({
                issue: 'Insecure Protocol Upgrades',
                recommendation: 'Your mail server is accepting older, vulnerable protocols like SSLv3 or TLSv1.',
                technicalDetails: 'Reconfigure your Mail Transfer Agent (MTA) to only accept TLSv1.2 or TLSv1.3.'
            });
        }
        if (report.scannerResults['network:blacklist:domain']?.flags.includes('DOMAIN_BLACKLISTED')) {
            recommendations.push({
                issue: 'Domain Actively Blacklisted',
                recommendation: 'Your domain is listed on a major Real-Time Blackhole List (RBL). Delivery to enterprise filters will bounce instantly.',
                technicalDetails: `Review the listing source provided in the raw data and submit a removal request immediately.`
            });
        }
        return recommendations;
    }
}
