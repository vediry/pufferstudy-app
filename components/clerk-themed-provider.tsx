"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

// Use Clerk's `dark` baseTheme for dark + forest (high contrast text on dark bg).
// Override only colorPrimary so each theme's accent (orange for dark, moss for forest)
// shows in buttons/links. Don't touch colorText / colorBackground — that broke contrast
// when we tried tinting the whole modal.

export function ClerkThemedProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const theme = mounted ? resolvedTheme : "light";
  const isDark = theme === "dark" || theme === "forest";

  let colorPrimary: string | undefined;
  if (theme === "forest") colorPrimary = "#6BBF8A"; // moss
  else if (theme === "dark") colorPrimary = "#FF7849"; // puffer orange (matches dark)
  // light: no override, use Clerk's default

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: {
          fontFamily: "var(--font-spline-sans)",
          ...(colorPrimary ? { colorPrimary } : {}),
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
