import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center">
      <Loader2 className="w-10 h-10 text-neutral-500 animate-spin mb-4" />
      <p className="text-neutral-400 animate-pulse">Loading telemetry data...</p>
    </main>
  );
}
