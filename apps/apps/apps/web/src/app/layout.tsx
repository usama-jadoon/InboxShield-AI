import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InboxShield AI",
  description: "Email Deliverability Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
