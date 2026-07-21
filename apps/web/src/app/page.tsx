import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, Activity, Mail, Search, Globe, ChevronRight } from "lucide-react";

export default function Dashboard() {
  return (
    <main className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Deliverability Analysis</h1>
          <p className="text-neutral-400">Enterprise diagnostic scanning and AI recommendations.</p>
        </div>
        <div className="flex gap-4 items-center">
          <Button variant="outline" className="gap-2 focus-ring">
            <Search className="w-4 h-4" />
            Scan New Domain
          </Button>
          <Button className="gap-2 focus-ring">
            <Mail className="w-4 h-4" />
            Connect ESP
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Global Deliverability Health</CardTitle>
            <CardDescription>Aggregate heuristic score across all authenticated workspaces.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-6 mb-4">
              <span className="text-6xl font-bold text-white tracking-tighter">84</span>
              <span className="text-xl text-neutral-500 mb-2 font-medium">/ 100</span>
            </div>
            <Progress value={84} className="h-3" aria-label="Global deliverability score is 84 out of 100" />
            <p className="mt-4 text-sm text-neutral-400">
              Risk Level: <span className="font-semibold text-amber-500">MEDIUM</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
            <CardDescription>Items severely impacting deliverability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-md">
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Missing DMARC Policy</p>
                <p className="text-xs text-neutral-500">client-b.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-md">
                <Activity className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Weak 1024-bit DKIM Key</p>
                <p className="text-xs text-neutral-500">marketing-a.com</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Globe className="w-5 h-5 text-neutral-400" aria-hidden="true" />
        Monitored Domains
      </h2>

      <div className="grid grid-cols-1 gap-4">
        {[
          { domain: "google.com", score: 100, risk: "LOW", issues: 0 },
          { domain: "client-b.com", score: 65, risk: "HIGH", issues: 2 },
          { domain: "marketing-a.com", score: 85, risk: "MEDIUM", issues: 1 },
        ].map((d) => (
          <Card key={d.domain} className="focus-ring hover:border-neutral-700 transition-colors group cursor-pointer" tabIndex={0} role="button" aria-label={`View domain details for ${d.domain}`}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                  ${d.score >= 90 ? 'bg-emerald-500/10 text-emerald-500'
                    : d.score >= 70 ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-rose-500/10 text-rose-500'}`}>
                  {d.score}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-1">{d.domain}</h3>
                  <div className="flex gap-3 text-sm">
                    <span className="text-neutral-400">Risk: <span className="text-white">{d.risk}</span></span>
                    <span className="text-neutral-600" aria-hidden="true">•</span>
                    <span className="text-neutral-400">Active Issues: <span className="text-white">{d.issues}</span></span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform" tabIndex={-1}>
                <ChevronRight className="w-5 h-5 text-neutral-400" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
