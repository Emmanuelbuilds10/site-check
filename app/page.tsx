"use client";

/**
 * Site Check - the whole flow lives on this one page:
 *   1. enter a URL and pick a mode
 *   2. watch the checks run
 *   3. read the grade, then the report, then the serious trust panel
 *   4. "Check another site" resets everything
 *
 * The accent colour is handed down through CSS variables, so every accent-aware
 * surface on the page - buttons, ring, bars, underlines - switches with the
 * mode in one go.
 */

import { useState, type CSSProperties } from "react";
import AnalyzeForm from "@/components/AnalyzeForm";
import CursorGlow from "@/components/CursorGlow";
import GradeCard from "@/components/GradeCard";
import LoadingIndicator from "@/components/LoadingIndicator";
import MagneticButton from "@/components/MagneticButton";
import Marquee from "@/components/Marquee";
import ReportSection from "@/components/ReportSection";
import SplitText from "@/components/SplitText";
import TrustSection from "@/components/TrustSection";
import type { AnalyzeSuccess, Mode } from "@/lib/types";

type View = "idle" | "loading" | "done" | "error";

/** Calm deep green for Friendly, burnt orange for Roast. */
const ACCENTS: Record<Mode, { accent: string; soft: string; contrast: string }> = {
  friendly: { accent: "#0f6f52", soft: "#e8f1ec", contrast: "#ffffff" },
  roast: { accent: "#d5480f", soft: "#fbe9dd", contrast: "#ffffff" },
};

const TICKER = [
  "Speed",
  "SEO",
  "Accessibility",
  "Best practices",
  "Safe Browsing",
  "Domain age",
  "HTTPS & SSL",
  "Redirects",
  "Security headers",
  "Trust signals",
];

const VIEW_STATUS: Record<View, { label: string; className: string }> = {
  idle: { label: "Ready", className: "bg-ink-faint" },
  loading: { label: "Scanning", className: "bg-[var(--accent)]" },
  done: { label: "Report ready", className: "bg-signal-good" },
  error: { label: "Needs attention", className: "bg-signal-bad" },
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("friendly");
  const [view, setView] = useState<View>("idle");
  const [result, setResult] = useState<AnalyzeSuccess | null>(null);
  const [error, setError] = useState("");

  /** Send the address to our own API route - the API keys never leave the server. */
  async function analyze() {
    if (view === "loading") return; // extra guard against double submits

    const entered = url.trim();
    if (entered === "") {
      setError("Please enter a website address to check.");
      setView("error");
      return;
    }

    setView("loading");
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: entered, mode }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Something went wrong while checking that site. Please try again.");
        setView("error");
        return;
      }

      setResult(data as AnalyzeSuccess);
      setView("done");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setView("error");
    }
  }

  /** Back to a blank form. */
  function reset() {
    setView("idle");
    setResult(null);
    setError("");
    setUrl("");
  }

  const theme = ACCENTS[mode];
  const status = VIEW_STATUS[view];

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={
        {
          "--accent": theme.accent,
          "--accent-soft": theme.soft,
          "--accent-contrast": theme.contrast,
        } as CSSProperties
      }
    >
      <CursorGlow />

      {/* ---------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-70 border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="4" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="var(--accent)" strokeWidth="1.6" />
            </svg>
            <span className="font-mono text-[11px] tracking-[0.28em] text-ink uppercase">
              Site&nbsp;Check
            </span>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${status.className} ${view === "loading" ? "animate-pulse-dot" : ""}`}
            />
            {status.label}
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-5">
        {/* ------------------------------------------------------------ hero */}
        <section className="pt-14 pb-10 sm:pt-20">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
              Website forensics
            </span>
            <span className="rule-dotted h-px flex-1" aria-hidden="true" />
            <span className="font-mono text-[10px] tracking-[0.18em] text-ink-faint">EST. 2026</span>
          </div>

          <h1 className="mt-7 max-w-4xl text-[2.6rem] leading-[0.98] font-bold tracking-[-0.03em] text-ink sm:text-[4.1rem]">
            <SplitText text="Is your website pulling" delay={80} />
            <span className="mt-1 block">
              <SplitText text="its weight?" delay={260} />
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Paste an address for four real scores from Google, then a calm, careful look at the
            warning signs worth knowing about before you trust a site.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            {["6 trust checks", "4 Google scores", "No account needed", "Nothing stored"].map(
              (item) => (
                <span
                  key={item}
                  className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint"
                >
                  <span aria-hidden="true" className="text-[var(--accent)]">
                    ◆
                  </span>
                  {item}
                </span>
              ),
            )}
          </div>
        </section>

        {/* ---------------------------------------------------------- ticker */}
        <div className="-mx-5">
          <Marquee items={TICKER} />
        </div>

        {/* ------------------------------------------------------ input card */}
        {view !== "done" && (
          <section className="py-10">
            <div className="relative overflow-hidden rounded-3xl border border-line-strong bg-paper-2/80 p-6 shadow-[0_1px_2px_rgba(23,20,15,0.05),0_24px_50px_-40px_rgba(23,20,15,0.45)] backdrop-blur-sm sm:p-9">
              <span className="corner-ticks" aria-hidden="true" />

              <div className="mb-7 flex items-baseline justify-between gap-4">
                <h2 className="text-xl font-semibold tracking-tight text-ink">Check a website</h2>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint sm:block">
                  Enter ↵ to run
                </span>
              </div>

              <AnalyzeForm
                url={url}
                mode={mode}
                loading={view === "loading"}
                onUrlChange={setUrl}
                onModeChange={setMode}
                onSubmit={analyze}
              />

              {view === "loading" && <LoadingIndicator mode={mode} url={url.trim()} />}

              {view === "error" && (
                <div className="mt-8 animate-rise rounded-2xl border border-signal-bad/35 bg-signal-bad/6 p-5">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-signal-bad/40 font-mono text-[11px] text-signal-bad"
                    >
                      !
                    </span>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-bad">
                        Could not run that check
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-ink">{error}</p>
                    </div>
                  </div>

                  <MagneticButton
                    onClick={analyze}
                    strength={5}
                    className="mt-5 rounded-full border border-signal-bad/40 bg-paper-2 px-5 py-2.5 font-mono text-[11px] tracking-[0.08em] text-signal-bad"
                  >
                    Try again
                  </MagneticButton>
                </div>
              )}
            </div>
          </section>
        )}

        {/* --------------------------------------------------------- results */}
        {view === "done" && result && (
          <div className="space-y-10 pt-12 pb-8">
            {/* Result header */}
            <div className="animate-fade-in">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
                    Results for
                  </p>
                  <a
                    href={result.finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block truncate text-xl font-semibold tracking-tight text-ink underline decoration-line-strong decoration-2 underline-offset-4 transition-colors hover:decoration-[var(--accent)]"
                  >
                    {result.finalUrl}
                  </a>
                </div>

                <span className="rounded-full border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                  {result.mode === "roast" ? "Roast mode" : "Friendly mode"}
                </span>
              </div>
              <span className="rule-dotted mt-5 block h-px" aria-hidden="true" />
            </div>

            <GradeCard
              score={result.score}
              grade={result.grade}
              categoryScores={result.categoryScores}
              scoreNote={result.scoreNote}
            />

            <ReportSection report={result.report} />

            <TrustSection trust={result.trust} />

            <div className="flex flex-col items-center gap-4 pt-4">
              <MagneticButton
                onClick={reset}
                sheen
                strength={7}
                className="rounded-full bg-[var(--accent)] px-8 py-4 font-mono text-[12px] tracking-[0.12em] text-[var(--accent-contrast)]"
              >
                Check another site
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  ↺
                </span>
              </MagneticButton>
              <p className="font-mono text-[10px] tracking-[0.12em] text-ink-faint">
                Resets everything, keeps nothing
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------ ticker */}
      <div className="relative z-10 mt-6">
        <Marquee items={TICKER} reverse />
      </div>

      {/* ------------------------------------------------------------ footer */}
      <footer className="relative z-10 border-t border-line bg-paper-2/60">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] leading-relaxed tracking-[0.1em] text-ink-faint">
            Built by{" "}
            {/* TODO: swap this placeholder for your own link */}
            <a
              href="https://github.com/emmanuel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-[var(--accent)]"
            >
              Emmanuel
            </a>
          </p>
          <p className="font-mono text-[10px] leading-relaxed tracking-[0.1em] text-ink-faint">
            Speed and safety data from Google PageSpeed Insights and Safe Browsing.
          </p>
        </div>
      </footer>
    </div>
  );
}
