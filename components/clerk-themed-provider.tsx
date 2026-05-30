"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useDeskTheme, THEMES } from "@/components/theme-provider";

export function ClerkThemedProvider({ children }: { children: React.ReactNode }) {
  const { themeId } = useDeskTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const theme = mounted ? THEMES.find((t) => t.id === themeId) ?? THEMES[0] : THEMES[0];
  const isDark = theme.mode === "dark";

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: {
          fontFamily: "var(--font-figtree)",
          colorPrimary: theme.css["--accent"],
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
