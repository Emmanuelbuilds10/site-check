"use client";

/**
 * The URL field, the mode switch and the submit button.
 *
 * The field is built as one bordered instrument: a mono label chip on the left,
 * the address in the middle, and the button on the right. The button is
 * disabled while a check runs, so nobody can fire off repeat requests.
 */

import type { Mode } from "@/lib/types";
import MagneticButton from "@/components/MagneticButton";
import ModeToggle from "@/components/ModeToggle";

interface AnalyzeFormProps {
  url: string;
  mode: Mode;
  loading: boolean;
  onUrlChange: (value: string) => void;
  onModeChange: (mode: Mode) => void;
  onSubmit: () => void;
}

export default function AnalyzeForm({
  url,
  mode,
  loading,
  onUrlChange,
  onModeChange,
  onSubmit,
}: AnalyzeFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {/* The address field */}
        <label
          className={`group flex flex-1 items-center gap-3 rounded-2xl border bg-paper-2 px-4 py-4 transition-colors duration-300 ${
            loading
              ? "border-line"
              : "border-line-strong focus-within:border-[var(--accent)]"
          }`}
        >
          <span className="shrink-0 rounded-md border border-line bg-paper-3 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            url
          </span>
          <span className="sr-only">Website address</span>
          <input
            id="site-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="yourbusiness.com"
            value={url}
            disabled={loading}
            onChange={(event) => onUrlChange(event.target.value)}
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-faint/70 disabled:opacity-60"
          />
        </label>

        {/* The submit button */}
        <MagneticButton
          type="submit"
          disabled={loading}
          sheen
          strength={7}
          className="rounded-2xl bg-[var(--accent)] px-7 py-4 font-mono text-[13px] tracking-[0.12em] text-[var(--accent-contrast)] shadow-[0_1px_0_rgba(0,0,0,0.12)]"
        >
          {mode === "roast" ? "Roast it" : "Analyze"}
          <span
            aria-hidden="true"
            className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
          >
            →
          </span>
        </MagneticButton>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <ModeToggle mode={mode} onChange={onModeChange} disabled={loading} />

        <p className="max-w-[15rem] font-mono text-[10px] leading-relaxed tracking-[0.06em] text-ink-faint">
          One address, four scores and six safety checks. No account, nothing stored.
        </p>
      </div>
    </form>
  );
}
