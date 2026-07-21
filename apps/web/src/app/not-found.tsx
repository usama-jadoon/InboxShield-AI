import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className="p-4 bg-neutral-900 rounded-full mb-6 border border-neutral-800">
        <AlertCircle className="w-12 h-12 text-rose-500" />
      </div>
      <h1 className="text-4xl font-bold text-white mb-4">404 - Page Not Found</h1>
      <p className="text-neutral-400 max-w-md mx-auto mb-8">
        The domain diagnostic or page you are looking for does not exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/">Return to Dashboard</Link>
      </Button>
    </main>
  );
}
