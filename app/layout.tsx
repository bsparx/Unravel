import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { ThemeScript } from "@/components/theme-script";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontVariables } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Unravel",
    template: "%s · Unravel",
  },
  description:
    "A calm place to keep your todos and habits, and a visual timer that shows you where the time actually went.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${fontVariables} h-full antialiased`}
    >
      <head>
        {/* Must run before the first paint, or every fresh document flashes
            cream paper at a dark-theme user. A Server Component, deliberately —
            React never executes a script rendered on the client, which is what
            it warns about when a client provider tries this. */}
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Clerk 7 + Next 16: ClerkProvider goes inside <body>, not around <html>. */}
        <ClerkProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster position="bottom-center" />
        </ClerkProvider>
      </body>
    </html>
  );
}
