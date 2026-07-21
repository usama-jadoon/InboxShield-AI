export default function MetricCard({ title, value, trend, isGood }: { title: string; value: string | number; trend: string; isGood: boolean }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-medium text-neutral-400 mb-2">{title}</h3>
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-white">{value}</span>
        <span className={`text-sm font-medium ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}
