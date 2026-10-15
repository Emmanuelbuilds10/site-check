"use client";

/**
 * Trust & Safety.
 *
 * This panel is deliberately the calmest thing on the page: paper, hairlines,
 * mono labels, no jokes and no accent colour - even in Roast mode. It describes
 * the signals it found and never says a site is a scam. The disclaimer at the
 * bottom is part of the panel, not a footnote.
 */

import Reveal from "@/components/Reveal";
import type { CheckStatus, TrustLevel, TrustSummary } from "@/lib/types";

const LEVEL_TONE: Record<TrustLevel, { text: string; border: string; bg: string; dot: string }> = {
  "No red flags found": {
    text: "text-signal-good",
    border: "border-signal-good/35",
    bg: "bg-signal-good/8",
    dot: "bg-signal-good",
  },
  "Some caution signs": {
    text: "text-signal-warn",
    border: "border-signal-warn/35",
    bg: "bg-signal-warn/8",
    dot: "bg-signal-warn",
  },
  "Multiple red flags": {
    text: "text-signal-bad",
    border: "border-signal-bad/35",
    bg: "bg-signal-bad/8",
    dot: "bg-signal-bad",
  },
};

const STATUS: Record<
  CheckStatus,
  { glyph: string; label: string; text: string; border: string }
> = {
  ok: { glyph: "✓", label: "Passed", text: "text-signal-good", border: "border-signal-good/40" },
  caution: { glyph: "!", label: "Caution", text: "text-signal-warn", border: "border-signal-warn/40" },
  red_flag: { glyph: "✕", label: "Warning sign", text: "text-signal-bad", border: "border-signal-bad/40" },
  unknown: { glyph: "?", label: "Could not check", text: "text-ink-faint", border: "border-line-strong" },
};

export default function TrustSection({ trust }: { trust: TrustSummary }) {
  const tone = LEVEL_TONE[trust.level];

  return (
    <section>
      {/* Section label */}
      <div className="mb-5 flex items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
          02 / Trust &amp; Safety
        </span>
        <span className="rule-dotted h-px flex-1" aria-hidden="true" />
      </div>

      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-line-strong bg-paper-2 shadow-[0_1px_2px_rgba(23,20,15,0.04)]">
          <span className="corner-ticks" aria-hidden="true" />

          {/* Level */}
          <div className="flex flex-col gap-4 border-b border-line px-7 py-6 sm:flex-row sm:items-center sm:justify-between">
            <span
              className={`inline-flex items-center gap-3 self-start rounded-full border px-4 py-2 font-mono text-[11px] tracking-[0.06em] ${tone.border} ${tone.bg} ${tone.text}`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 animate-pulse-dot rounded-full ${tone.dot}`}
              />
              {trust.level}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              {trust.checks.length} signals checked
            </span>
          </div>

          {/* Checklist */}
          <ul className="divide-y divide-line">
            {trust.checks.map((check) => {
              const status = STATUS[check.status] ?? STATUS.unknown;
              return (
                <li key={check.name} className="px-7 py-5">
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-[12px] ${status.border} ${status.text}`}
                    >
                      {status.glyph}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-medium text-ink">{check.name}</span>
                        <span className={`font-mono text-[10px] tracking-[0.08em] ${status.text}`}>
                          {status.label}
                        </span>
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{check.detail}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Plain-English reading */}
          <div className="border-t border-line bg-paper px-7 py-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              What this means
            </p>
            <p className="mt-3 leading-relaxed text-ink">{trust.summary}</p>

            {trust.advice.length > 0 && (
              <ol className="mt-6 space-y-3 border-t border-line pt-6">
                {trust.advice.map((tip, index) => (
                  <li key={tip} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                    <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {tip}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* The disclaimer stays, always */}
          <div className="border-t border-line-strong bg-paper-3/60 px-7 py-5">
            <p className="flex gap-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-ink-soft">
              <span aria-hidden="true" className="text-ink-faint">
                !
              </span>
              This check looks for common warning signs only. It cannot confirm whether a site is
              legitimate or fraudulent. Always do your own research before paying or sharing
              personal info.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
