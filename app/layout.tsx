import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { ClerkThemedProvider } from "@/components/clerk-themed-provider";
import { ThemeProvider, ThemeAntiFlashScript } from "@/components/theme-provider";
import { WallpaperModeProvider } from "@/components/wallpaper-mode";
import { ChromeShell } from "@/components/chrome-shell";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PufferStudy — Your study workspace",
  description:
    "Per-subject hub for notes, cheat sheets, chat, assignments, and more.",
  applicationName: "PufferStudy",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9e0d0" },
    { media: "(prefers-color-scheme: dark)", color: "#241f1a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="latte"
      className={figtree.variable}
    >
      <head>
        <ThemeAntiFlashScript />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider>
          <WallpaperModeProvider>
            <ClerkThemedProvider>
              <ChromeShell>{children}</ChromeShell>
            </ClerkThemedProvider>
          </WallpaperModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
