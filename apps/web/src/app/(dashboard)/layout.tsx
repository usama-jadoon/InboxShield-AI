import Sidebar from "@/components/Sidebar";

/**
 * Authenticated app chrome. Route group — does not affect URLs, so `/` and
 * `/domains/[...]` keep their current paths while gaining the Sidebar and
 * full-height flex content area. Auth-facing routes outside this group
 * (`/login`) render without the chrome.
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-x-hidden min-w-0">
        {children}
      </div>
    </div>
  );
}
