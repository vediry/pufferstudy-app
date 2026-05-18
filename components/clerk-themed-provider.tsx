"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

// Mirror the palette in globals.css for each theme so Clerk's internal
// color math (hover tints, opacity stops, etc.) uses concrete hex values.
const FOREST_PALETTE = {
  colorPrimary: "#6BBF8A",
  colorBackground: "#16241C",
  colorInputBackground: "#1B2E23",
  colorText: "#EDE8DA",
  colorTextSecondary: "#8FB39B",
  colorInputText: "#EDE8DA",
  colorNeutral: "#EDE8DA",
};

const DARK_OVERRIDES = {
  colorPrimary: "#FF7849",
};

const SHARED_VARIABLES = {
  fontFamily: "var(--font-spline-sans)",
};

const SHARED_ELEMENTS = {
  formButtonPrimary: "hover:opacity-90",
  footerActionLink: "hover:opacity-80",
};

export function ClerkThemedProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const theme = mounted ? resolvedTheme : "light";
  const isDark = theme === "dark" || theme === "forest";

  const variables = {
    ...SHARED_VARIABLES,
    ...(theme === "forest" ? FOREST_PALETTE : theme === "dark" ? DARK_OVERRIDES : {}),
  };

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables,
        elements: SHARED_ELEMENTS,
      }}
    >
      {children}
    </ClerkProvider>
  );
}
