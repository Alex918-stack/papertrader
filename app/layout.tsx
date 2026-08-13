import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { PortfolioProvider } from "@/lib/PortfolioContext";
import AuthProvider from "@/components/layout/AuthProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Paper Trader",
  description:
    "Practice stock trading with real market data and an AI assistant - no real money at risk.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, sourceSerif.variable, "font-sans", inter.variable)}
    >
<body className="min-h-full flex flex-col" suppressHydrationWarning>
<AuthProvider>
          <PortfolioProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </PortfolioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}