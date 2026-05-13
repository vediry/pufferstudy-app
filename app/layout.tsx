import type { Metadata, Viewport } from "next";
import { Spline_Sans, Spline_Sans_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import "./globals.css";

const splineSans = Spline_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-spline-sans",
  display: "swap",
});

const splineSansMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-spline-sans-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PufferStudy — Turn your notes into a cheat sheet",
  description:
    "Upload photos of your homework and notes. PufferStudy organizes them and helps you study before a test.",
  applicationName: "PufferStudy",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7EE" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1814" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${splineSans.variable} ${splineSansMono.variable}`}
    >
      <body className="min-h-dvh bg-canvas text-ink">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="flex min-h-dvh flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <footer className="mt-auto border-t border-default py-6 text-center text-sm text-ink-faint">
              <span className="mx-auto">PufferStudy · Your notes, organized.</span>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
