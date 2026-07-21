import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "InboxShield AI",
  description: "Enterprise Email Deliverability Intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-black text-white flex min-h-screen">
        <Sidebar />
        <div className="flex-1 overflow-x-hidden min-w-0">
          {children}
        </div>
      </body>
    </html>
  );
}
