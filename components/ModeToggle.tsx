"use client";

/**
 * The Friendly / Roast my site switch.
 *
 * A single accent thumb slides between the two options instead of each button
 * lighting up on its own - one moving part reads as a switch, not as a pair of
 * buttons. The label under the control explains what the chosen mode does.
 */

import type { Mode } from "@/lib/types";

const OPTIONS: { value: Mode; label: string; note: string }[] = [
  { value: "friendly", label: "Friendly", note: "Plain English, kind words, no jargon." },
  {
    value: "roast",
    label: "Roast my site",
    note: "Sarcastic on the surface, genuinely useful underneath.",
  },
];

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  const active = OPTIONS.find((option) => option.value === mode) ?? OPTIONS[0];

  return (
    <div>
      <div
        role="group"
        aria-label="Report style"
        className="relative grid w-full grid-cols-2 rounded-full border border-line-strong bg-paper-2 p-1 sm:w-[19rem]"
      >
        {/* The sliding thumb. Its width is exactly one cell, so translate-x-full
            lands it perfectly on the second option. */}
        <span
          aria-hidden="true"
          className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-[var(--accent)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            mode === "roast" ? "translate-x-full" : "translate-x-0"
          }`}
        />

        {OPTIONS.map((option) => {
          const selected = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`relative z-10 rounded-full px-3 py-2 font-mono text-[11px] tracking-[0.08em] transition-colors duration-300 disabled:cursor-not-allowed ${
                selected ? "text-[var(--accent-contrast)]" : "text-ink-faint hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-ink-faint">
        {active.note}
      </p>
    </div>
  );
}
