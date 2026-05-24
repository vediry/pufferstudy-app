"use client";

import * as React from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionErrorEvent = { error: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type Props = {
  /**
   * Called with each piece of recognized text. `final` means the engine is
   * confident it won't revise the words; `interim` is the live partial.
   * Component itself doesn't write to the parent's input — caller decides
   * how to merge into existing text.
   */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Disabled when chat is mid-send so input doesn't get clobbered. */
  disabled?: boolean;
  className?: string;
};

function getRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function DictationButton({ onTranscript, disabled, className }: Props) {
  const [supported, setSupported] = React.useState<boolean>(false);
  const [listening, setListening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);

  React.useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const stop = React.useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const txt = r[0].transcript;
        if (r.isFinal) finalText += txt;
        else interim += txt;
      }
      if (finalText) onTranscript(finalText, true);
      if (interim) onTranscript(interim, false);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(
        e.error === "not-allowed"
          ? "Allow microphone access to dictate."
          : "Couldn't hear you — try again.",
      );
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [onTranscript]);

  // Stop dictation when the component unmounts.
  React.useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  if (!supported) {
    // Render nothing rather than a permanently-broken button on Firefox/etc.
    return null;
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        disabled={disabled}
        title={listening ? "Stop dictation" : "Dictate (your voice becomes text)"}
        aria-label={listening ? "Stop dictation" : "Start dictation"}
        aria-pressed={listening}
        className={cn(
          "glow-on-hover inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-default text-ink-muted transition-colors",
          "hover:bg-surface-2 hover:text-ink",
          "disabled:cursor-not-allowed disabled:opacity-50",
          listening
            ? "border-[color:var(--danger)] bg-[color:var(--danger)]/10 text-[color:var(--danger)]"
            : "bg-surface-2",
        )}
      >
        {listening ? (
          <span className="relative inline-flex">
            <Square className="h-4 w-4" strokeWidth={2} fill="currentColor" />
            <span className="absolute -right-1 -top-1 inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--danger)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--danger)]" />
            </span>
          </span>
        ) : (
          <Mic className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
      {error ? (
        <span className="absolute bottom-full right-0 mb-1 whitespace-nowrap rounded-md border border-default bg-surface px-2 py-1 text-[11px] text-ink-muted shadow-soft">
          {error}
        </span>
      ) : null}
    </div>
  );
}
