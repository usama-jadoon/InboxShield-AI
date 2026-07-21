import MetricCard from "@/components/MetricCard";

export default function Dashboard() {
  return (
    <main className="p-8 max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Platform Overview</h1>
        <p className="text-neutral-400">Total volume and deliverability metrics across all workspaces.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Total Sent (24h)" value="1.2M" trend="+12.5%" isGood={true} />
        <MetricCard title="Deliverability Score" value="98.4%" trend="+0.2%" isGood={true} />
        <MetricCard title="Bounce Rate" value="1.2%" trend="-0.4%" isGood={true} />
        <MetricCard title="Complaint Rate" value="0.08%" trend="+0.02%" isGood={false} />
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 h-96 flex items-center justify-center">
        <p className="text-neutral-500 font-medium">[Chart: Deliveries vs Bounces over Time]</p>
      </div>
    </main>
  );
}
