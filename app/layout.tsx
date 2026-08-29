import type { Metadata } from "next";
import { Bricolage_Grotesque, Source_Serif_4 } from "next/font/google";
import { GeistMono as geistMono } from "geist/font/mono";
import "./globals.css";
import { PortfolioProvider } from "@/lib/PortfolioContext";
import AuthProvider from "@/components/layout/AuthProvider";
import { JournalProvider } from "@/components/journal/JournalProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-sans",
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
      className={cn(
        "h-full",
        "antialiased",
        bricolageGrotesque.variable,
        geistMono.variable,
        sourceSerif.variable,
        "font-sans"
      )}
    >
<body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900" suppressHydrationWarning>
<AuthProvider>
          <JournalProvider>
            <PortfolioProvider>
              <ToastProvider>{children}</ToastProvider>
            </PortfolioProvider>
          </JournalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}