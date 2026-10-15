"use client";

/**
 * The waiting screen.
 *
 * A scan line sweeps the panel, four channel lights pulse out of step, and the
 * message fades out and swaps every 2.5 seconds, looping forever so it never
 * gets stuck on the last line. The channel lights are decorative - every check
 * genuinely runs at the same time, which the small print says out loud.
 */

import { useEffect, useState } from "react";
import type { Mode } from "@/lib/types";

const MESSAGES: Record<Mode, string[]> = {
  friendly: [
    "Checking how fast your site loads...",
    "Looking for broken pieces...",
    "Testing on a mobile phone...",
    "Peeking at your SEO basics...",
    "Checking if this site is safe...",
    "Almost done, writing your report...",
  ],
  roast: [
    "Checking if your site survives on 3G...",
    "Counting the things that went wrong...",
    "Asking your site why it's so slow...",
    "Finding the crime scene...",
    "Checking if this site is even safe...",
    "Preparing the roast, please hold...",
  ],
};

const CHANNELS = ["speed", "seo", "a11y", "safety"];

const ROTATE_EVERY_MS = 2500; // spec: a new message every 2.5 seconds
const FADE_MS = 350; // matches the opacity transition below

export default function LoadingIndicator({ mode, url }: { mode: Mode; url?: string }) {
  const messages = MESSAGES[mode];

  // The mode rides along with the index, so switching modes can restart the
  // list during render instead of needing an effect to reset it.
  const [state, setState] = useState<{ mode: Mode; index: number; visible: boolean }>({
    mode,
    index: 0,
    visible: true,
  });

  const index = state.mode === mode ? state.index : 0;
  const visible = state.mode === mode ? state.visible : true;

  useEffect(() => {
    let swapTimer: ReturnType<typeof setTimeout> | undefined;

    const interval = setInterval(() => {
      setState((current) => ({ ...current, visible: false })); // fade out

      swapTimer = setTimeout(() => {
        setState((current) => {
          const nextIndex = (current.mode === mode ? current.index : 0) + 1;
          return {
            mode,
            index: nextIndex % messages.length, // loop, never stop on the last one
            visible: true,
          };
        });
      }, FADE_MS);
    }, ROTATE_EVERY_MS);

    return () => {
      clearInterval(interval);
      if (swapTimer) clearTimeout(swapTimer);
    };
  }, [mode, messages]);

  return (
    <div className="mt-8 animate-fade-in overflow-hidden rounded-2xl border border-line bg-paper-2">
      {/* The sweeping scan line */}
      <div className="relative h-px w-full overflow-hidden bg-line">
        <div className="absolute inset-0 animate-scan bg-[var(--accent)]" />
      </div>

      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
            Analysing
          </p>
          {url && (
            <p className="mt-1 truncate font-mono text-[13px] text-ink-soft">{url}</p>
          )}

          <p
            aria-live="polite"
            className={`mt-5 text-lg leading-snug font-medium text-ink transition-opacity duration-300 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
          >
            {messages[index]}
          </p>
        </div>

        {/* Channel lights */}
        <div className="flex gap-4 sm:flex-col sm:gap-3">
          {CHANNELS.map((channel, position) => (
            <span
              key={channel}
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[var(--accent)]"
                style={{ animationDelay: `${position * 260}ms` }}
              />
              {channel}
            </span>
          ))}
        </div>
      </div>

      <p className="border-t border-line px-6 py-3 font-mono text-[10px] leading-relaxed tracking-[0.06em] text-ink-faint">
        All checks run at the same time. A full pass usually takes 10 to 30 seconds.
      </p>
    </div>
  );
}
