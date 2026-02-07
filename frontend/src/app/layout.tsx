import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CXC — Sports Betting Intelligence",
  description: "Real-time Polymarket sports odds and AI-powered insights",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-bg-primary text-text-primary min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
