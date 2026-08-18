import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Test Hub — Board-ready test papers for schools",
  description:
    "Multi-tenant test paper generator for schools, academies, and universities. Auto or manual generation, schedules, and print-ready exports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-paper text-ink" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
