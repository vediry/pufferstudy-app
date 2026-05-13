import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-[var(--radius)] border border-default bg-surface px-3.5 py-2 text-base text-ink transition-colors",
        "placeholder:text-ink-faint",
        "focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2 focus-visible:border-strong",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
