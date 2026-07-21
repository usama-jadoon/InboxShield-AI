import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, FileText, ArrowLeft, Bot, RefreshCw } from "lucide-react";
import Link from 'next/link';

export default async function DomainDetail(props: { params: Promise<{ domain: string }> }) {
  const params = await props.params;
  const domain = params.domain;

  // Mocked engine report resolution
  const isHealthy = domain === 'google.com';

  return (
    <main className="p-8 max-w-5xl mx-auto w-full animate-in slide-in-from-bottom-4 duration-500">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </Link>

      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{domain}</h1>
          <p className="text-neutral-400">Diagnostic snapshot generated just now.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Rescan
          </Button>
          <Button className="gap-2">
            <FileText className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
      </header>

      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Bot className="w-5 h-5 text-neutral-400" />
          AI Recommendations
        </h2>

        {isHealthy ? (
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-6 flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-emerald-500 mt-1" />
              <div>
                <h3 className="font-semibold text-emerald-400 mb-2">Optimal Configuration</h3>
                <p className="text-neutral-300 text-sm leading-relaxed">
                  No vulnerabilities detected. All critical protocols (SPF, DKIM, DMARC, TLS) are securely configured resulting in maximum sender reputation probability.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="bg-rose-500/5 border-rose-500/20">
              <CardContent className="p-6 flex items-start gap-4">
                <ShieldAlert className="w-6 h-6 text-rose-500 mt-1" />
                <div>
                  <h3 className="font-semibold text-rose-400 mb-2">Missing DMARC Policy</h3>
                  <p className="text-neutral-300 text-sm leading-relaxed mb-4">
                    Without DMARC, anyone can pretend to send email as you. Major providers (Gmail/Yahoo) will block your emails completely.
                  </p>
                  <div className="bg-black/50 p-4 rounded-md border border-neutral-800/50">
                     <p className="text-xs text-neutral-500 mb-1">Technical Mitigation</p>
                     <code className="text-sm text-neutral-300">Create a TXT record at _dmarc.{domain} with &apos;v=DMARC1; p=quarantine;&apos;</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold mb-6">Diagnostic Telemetry</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { id: 'auth:spf', title: 'Sender Policy Framework', passed: isHealthy, val: isHealthy ? 'v=spf1 include:_spf.google.com ~all' : 'Missing Enforcement Policy' },
          { id: 'auth:dkim', title: 'DomainKeys Identified Mail', passed: isHealthy, val: isHealthy ? '2048-bit RSA Key Detected' : 'No selectors discovered' },
          { id: 'auth:dmarc', title: 'DMARC Enforcement', passed: isHealthy, val: isHealthy ? 'p=reject' : 'No records published' },
          { id: 'network:smtp:tls', title: 'MX Certificate Expiry', passed: true, val: 'Valid for 231 Days' }
        ].map(scan => (
          <Card key={scan.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">{scan.title}</CardTitle>
                {scan.passed ? (
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-semibold rounded mx-1">PASS</span>
                ) : (
                  <span className="px-2 py-1 bg-rose-500/10 text-rose-500 text-xs font-semibold rounded mx-1">FAIL</span>
                )}
              </div>
              <CardDescription className="font-mono text-xs mt-2">{scan.id}</CardDescription>
            </CardHeader>
            <CardContent>
               <p className={`text-sm ${scan.passed ? 'text-neutral-300' : 'text-rose-400'}`}>{scan.val}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
