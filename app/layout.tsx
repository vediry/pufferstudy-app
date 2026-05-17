import type { Metadata, Viewport } from "next";
import { Spline_Sans, Spline_Sans_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        variables: {
          colorPrimary: "var(--primary)",
          colorBackground: "var(--surface)",
          colorText: "var(--ink)",
          colorTextSecondary: "var(--ink-muted)",
          colorInputBackground: "var(--surface-2)",
          colorInputText: "var(--ink)",
          fontFamily: "var(--font-spline-sans)",
        },
        elements: {
          rootBox: "w-full max-w-md",
          card: "bg-surface border border-default shadow-card",
          headerTitle: "text-ink",
          headerSubtitle: "text-ink-muted",
          socialButtonsBlockButton: "bg-surface-2 border border-default text-ink hover:bg-surface-3",
          socialButtonsBlockButtonText: "text-ink",
          dividerLine: "bg-border",
          dividerText: "text-ink-faint",
          formFieldLabel: "text-ink",
          formFieldInput: "bg-surface-2 border border-default text-ink",
          formButtonPrimary: "bg-primary text-primary-foreground hover:opacity-90",
          footerActionText: "text-ink-muted",
          footerActionLink: "text-primary hover:opacity-80",
          identityPreviewText: "text-ink",
          identityPreviewEditButton: "text-primary",
        },
      }}
    >
      <html
        lang="en"
        suppressHydrationWarning
        className={`${splineSans.variable} ${splineSansMono.variable}`}
      >
        <body className="min-h-dvh bg-canvas text-ink">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            themes={["light", "dark", "forest"]}
            disableTransitionOnChange
          >
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
    </ClerkProvider>
  );
}
