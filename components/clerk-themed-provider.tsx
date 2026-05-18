"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

const SHARED_APPEARANCE = {
  variables: {
    colorPrimary: "var(--primary)",
    fontFamily: "var(--font-spline-sans)",
  },
  elements: {
    rootBox: "w-full max-w-md",
    card: "bg-surface border border-default shadow-card",
    formButtonPrimary: "bg-primary text-primary-foreground hover:opacity-90",
    formFieldInput: "bg-surface-2 border border-default text-ink",
    footerActionLink: "text-primary hover:opacity-80",
  },
};

export function ClerkThemedProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const useDark =
    mounted && (resolvedTheme === "dark" || resolvedTheme === "forest");

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        ...SHARED_APPEARANCE,
        baseTheme: useDark ? dark : undefined,
      }}
    >
      {children}
    </ClerkProvider>
  );
}
