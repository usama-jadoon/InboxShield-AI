'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { XOctagon } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service in production
    console.error('[Global Error Boundary]:', error);
  }, [error]);

  return (
    <main className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center">
      <div className="p-4 bg-rose-500/10 rounded-full mb-6 border border-rose-500/20">
        <XOctagon className="w-12 h-12 text-rose-500" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-4">System Error Encountered</h1>
      <p className="text-neutral-400 max-w-md mx-auto mb-8">
        A critical exception occurred while processing your request. Our engineering team has been notified.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} variant="default">
          Try Again
        </Button>
        <Button onClick={() => window.location.href = '/'} variant="outline">
          Return to Dashboard
        </Button>
      </div>
    </main>
  );
}
