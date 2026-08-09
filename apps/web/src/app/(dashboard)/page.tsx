import { cookies } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, Globe, ChevronRight, Search, Mail, Inbox } from "lucide-react";
import { sessionCookieName } from "@/lib/session";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value ?? "";
  const data = await getDashboardData(token);

  // No workspace assigned — render an honest empty state, never demo data.
  if (!data) {
    return (
      <main className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Deliverability Analysis</h1>
          <p className="text-neutral-400">Enterprise diagnostic scanning and AI recommendations.</p>
        </header>
        <Card>
          <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
            <div className="p-3 bg-neutral-800/50 text-neutral-400 rounded-md">
              <Inbox className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-medium text-white">No workspace assigned</h2>
            <p className="text-sm text-neutral-400 max-w-md">
              Sign in with an account that has a workspace membership to see live scan results.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { stats, globalRiskLevel } = data;
  const riskColor =
    globalRiskLevel === "LOW" ? "text-emerald-500"
    : globalRiskLevel === "MEDIUM" ? "text-amber-500"
    : "text-rose-500";

  const incidents = stats.domains.filter(
    (d) => d.latestRiskLevel === "HIGH" || d.latestRiskLevel === "CRITICAL",
  );

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
            <CardDescription>Average latest scan score across {stats.totalDomains} monitored domain{stats.totalDomains === 1 ? "" : "s"}.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.averageScore === null ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl text-neutral-500">—</span>
                <span className="text-sm text-neutral-400">No scans yet. Register a domain and run your first scan.</span>
              </div>
            ) : (
              <div className="flex items-end gap-6 mb-4">
                <span className="text-6xl font-bold text-white tracking-tighter">{stats.averageScore}</span>
                <span className="text-xl text-neutral-500 mb-2 font-medium">/ 100</span>
              </div>
            )}
            {stats.averageScore !== null && (
              <Progress value={stats.averageScore} className="h-3" aria-label={`Global deliverability score is ${stats.averageScore} out of 100`} />
            )}
            <p className="mt-4 text-sm text-neutral-400">
              Risk Level: <span className={`font-semibold ${riskColor}`}>{globalRiskLevel}</span>
              <span className="text-neutral-600" aria-hidden="true"> • </span>
              <span className="text-neutral-400">{stats.totalScans} total scan{stats.totalScans === 1 ? "" : "s"}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
            <CardDescription>Domains at HIGH or CRITICAL risk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {incidents.length === 0 ? (
              <p className="text-sm text-neutral-400">No active incidents.</p>
            ) : (
              incidents.map((d) => (
                <div key={d.domainId} className="flex items-center gap-3">
                  <div className={`p-2 ${d.latestRiskLevel === "CRITICAL" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"} rounded-md`}>
                    <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{d.domainName}</p>
                    <p className="text-xs text-neutral-500">{d.latestRiskLevel} risk · score {d.latestScore}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Globe className="w-5 h-5 text-neutral-400" aria-hidden="true" />
        Monitored Domains
      </h2>

      <div className="grid grid-cols-1 gap-4">
        {stats.domains.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-neutral-400">
              No domains registered yet. Register a domain to start scanning.
            </CardContent>
          </Card>
        ) : (
          stats.domains.map((d) => {
            const score = d.latestScore;
            const badgeColor =
              score === null ? "bg-neutral-800/50 text-neutral-400"
              : score >= 90 ? "bg-emerald-500/10 text-emerald-500"
              : score >= 70 ? "bg-amber-500/10 text-amber-500"
              : "bg-rose-500/10 text-rose-500";
            return (
              <Card key={d.domainId} className="focus-ring hover:border-neutral-700 transition-colors group cursor-pointer" tabIndex={0} role="button" aria-label={`View domain details for ${d.domainName}`}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${badgeColor}`}>
                      {score === null ? "—" : score}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white mb-1">{d.domainName}</h3>
                      <div className="flex gap-3 text-sm">
                        <span className="text-neutral-400">Risk: <span className="text-white">{d.latestRiskLevel ?? "UNSCANNED"}</span></span>
                        <span className="text-neutral-600" aria-hidden="true">•</span>
                        <span className="text-neutral-400">Scans: <span className="text-white">{d.scanCount}</span></span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform" tabIndex={-1}>
                    <ChevronRight className="w-5 h-5 text-neutral-400" />
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
