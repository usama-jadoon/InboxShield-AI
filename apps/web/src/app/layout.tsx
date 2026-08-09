import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InboxShield AI",
  description: "Enterprise Email Deliverability Intelligence",
};

/**
 * Minimal root layout. The authenticated app chrome (Sidebar) lives in the
 * `(dashboard)` route group layout so auth-facing pages (e.g. /login) render
 * full-screen without it. URLs are unaffected by the route group.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-black text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
