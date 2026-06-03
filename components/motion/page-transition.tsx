"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Gently fades the main content up on each route change. Keyed on pathname so a
 * navigation remounts the wrapper and replays `.animate-page-in`. Reduced-motion
 * is handled globally (the @media rule zeroes animation duration → instant).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
