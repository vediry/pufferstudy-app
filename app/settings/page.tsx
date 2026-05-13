"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSettings, saveSettings } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [apiKey, setApiKey] = React.useState("");
  const [reveal, setReveal] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setApiKey(getSettings().geminiKey ?? "");
    setLoaded(true);
  }, []);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    saveSettings({ geminiKey: apiKey.trim() || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function onClear() {
    setApiKey("");
    saveSettings({ geminiKey: null });
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Back to subjects
      </Link>

      <h1 className="mb-8 text-[2rem] font-bold leading-[1.15] tracking-tight text-ink sm:text-[2.25rem]">
        Settings
      </h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Google Gemini API key</CardTitle>
          <CardDescription>
            PufferStudy uses your own free Gemini key to generate cheat sheets and answer questions.
            Your key stays in this browser only — we never store it on a server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey">API key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={reveal ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={loaded ? "Paste your Gemini API key" : ""}
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-12 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? "Hide API key" : "Show API key"}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-ink-muted hover:text-ink"
                >
                  {reveal ? (
                    <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  )}
                </button>
              </div>
              <p className="text-[13px] text-ink-faint">
                Don&apos;t paste keys you wouldn&apos;t feel safe losing. Clear the field to remove the key.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit">
                {saved ? <Check /> : null}
                {saved ? "Saved" : "Save key"}
              </Button>
              {apiKey ? (
                <Button type="button" variant="ghost" onClick={onClear}>
                  Clear key
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Where do I get a Gemini key?</CardTitle>
        </CardHeader>
        <CardContent className="text-[15px] leading-relaxed text-ink-muted">
          <ol className="flex list-decimal flex-col gap-2 pl-5 marker:text-ink-faint">
            <li>
              Open{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className={cn("text-[var(--primary)] underline-offset-4 hover:underline")}
              >
                Google AI Studio <ExternalLink className="inline h-4 w-4 align-[-2px]" strokeWidth={1.75} />
              </a>{" "}
              and sign in with any Google account.
            </li>
            <li>Click <span className="text-ink">Create API key</span>.</li>
            <li>Copy the key and paste it into the field above.</li>
            <li>The free tier covers plenty of study sessions — no payment info needed.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Use the sun/moon button in the top-right corner of any page to switch between light, dark, and system.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
