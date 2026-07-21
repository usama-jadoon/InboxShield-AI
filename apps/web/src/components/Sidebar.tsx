import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-neutral-900 border-r border-neutral-800 text-neutral-300 flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-neutral-800 font-semibold text-white tracking-wide">
        InboxShield AI
      </div>
      <nav className="flex-1 py-6 px-4 space-y-2">
        <Link href="/" className="block px-4 py-2 rounded-md hover:bg-neutral-800 hover:text-white transition-colors">
          Overview
        </Link>
        <Link href="/domains" className="block px-4 py-2 rounded-md hover:bg-neutral-800 hover:text-white transition-colors">
          Domains
        </Link>
        <Link href="/routing" className="block px-4 py-2 rounded-md hover:bg-neutral-800 hover:text-white transition-colors">
          OmniRoute
        </Link>
        <Link href="/logs" className="block px-4 py-2 rounded-md hover:bg-neutral-800 hover:text-white transition-colors">
          Logs
        </Link>
        <Link href="/settings" className="block px-4 py-2 rounded-md hover:bg-neutral-800 hover:text-white transition-colors">
          Settings
        </Link>
      </nav>
    </aside>
  );
}
