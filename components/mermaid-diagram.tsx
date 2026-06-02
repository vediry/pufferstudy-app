"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Maximize2, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { useDeskTheme, THEMES } from "@/components/theme-provider";

// Module-level counter so every render() call gets a unique id (mermaid throws
// if the same id is reused while a previous diagram is still in the DOM).
let diagramCounter = 0;

/**
 * Renders a Mermaid diagram (mindmap / flowchart / timeline / graph …) from a
 * code string. Mermaid is imported lazily on first use so it never weighs down
 * pages that don't show a diagram. Theme follows the app's light/dark mode.
 * Click the diagram to open a full-screen, zoomable lightbox (small labels in a
 * cramped inline diagram are otherwise hard to read). If the model emits invalid
 * syntax we fall back to showing the raw code so the chat never breaks.
 */
export function MermaidDiagram({ code }: { code: string }) {
  const { themeId } = useDeskTheme();
  const mode = THEMES.find((t) => t.id === themeId)?.mode ?? "light";
  const [svg, setSvg] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setFailed(false);
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: mode === "dark" ? "dark" : "neutral",
          fontFamily: "var(--font-sans, inherit)",
        });
        const { svg } = await mermaid.render(`mmd-${diagramCounter++}`, code.trim());
        if (!cancelled) setSvg(svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, mode]);

  if (failed) {
    return (
      <pre className="my-2 overflow-x-auto rounded-[10px] border border-default bg-surface-2/60 p-3 text-xs text-ink-muted">
        {code.trim()}
      </pre>
    );
  }

  if (!svg) {
    return <div className="my-2 text-xs text-ink-faint">rendering diagram…</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Click to expand"
        aria-label="Expand diagram"
        className="group relative my-2 block w-full cursor-zoom-in rounded-[12px] border border-default bg-surface-2/40 p-3 text-left transition-colors hover:border-strong"
      >
        <div
          className="overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-default bg-surface/90 px-2 py-1 text-[10px] font-semibold text-ink-muted opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Maximize2 className="h-3 w-3" strokeWidth={2} /> Expand
        </span>
      </button>
      {open ? (
        <Lightbox svg={svg} dark={mode === "dark"} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function Lightbox({ svg, dark, onClose }: { svg: string; dark: boolean; onClose: () => void }) {
  const [zoom, setZoom] = React.useState(1);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.25));
      if (e.key === "-") setZoom((z) => Math.max(0.5, z - 0.25));
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Expanded diagram"
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-end gap-1.5 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <ToolBtn label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          <ZoomOut className="h-4 w-4" strokeWidth={2} />
        </ToolBtn>
        <span className="min-w-[3rem] text-center text-xs font-semibold text-white/90">
          {Math.round(zoom * 100)}%
        </span>
        <ToolBtn label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
          <ZoomIn className="h-4 w-4" strokeWidth={2} />
        </ToolBtn>
        <ToolBtn label="Reset zoom" onClick={() => setZoom(1)}>
          <RotateCcw className="h-4 w-4" strokeWidth={2} />
        </ToolBtn>
        <ToolBtn label="Close" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={2} />
        </ToolBtn>
      </div>

      {/* Scrollable diagram surface — pan by scrolling when zoomed in. */}
      <div className="flex-1 overflow-auto p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto rounded-[12px] p-4 [&_svg]:h-auto [&_svg]:!w-full [&_svg]:!max-w-none"
          // Surface matches the diagram's mermaid theme so light-on-dark text stays legible.
          style={{ width: `${zoom * 90}vw`, maxWidth: "1600px", background: dark ? "#1f242c" : "#ffffff" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>,
    document.body,
  );
}

function ToolBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
    >
      {children}
    </button>
  );
}
