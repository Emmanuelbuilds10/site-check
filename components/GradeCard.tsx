"use client";

/**
 * The score reveal.
 *
 *  - the number counts up from 0 to the final score over ~1.5 seconds
 *  - the ring fills as it climbs, with a halo turning slowly behind it
 *  - the letter grade lands once the count finishes
 *  - the four category bars grow to their values underneath
 *
 * Grade colours are fixed by meaning: A green, B lime, C yellow, D orange,
 * F red. Everything else on the page can change with the mode; these cannot.
 */

import { useEffect, useState } from "react";
import TiltCard from "@/components/TiltCard";
import type { CategoryScores } from "@/lib/types";

/** Ring geometry: r=68 inside a 160x160 viewBox. */
const RADIUS = 68;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const GRADE_COLOURS: Record<string, string> = {
  A: "#14663f",
  B: "#4d7c0f",
  C: "#b07d00",
  D: "#c25a12",
  F: "#a8271b",
};

const UNKNOWN_COLOUR = "#8b8274";

const COUNT_DURATION_MS = 1500;

const CATEGORIES: { key: keyof CategoryScores; label: string; code: string }[] = [
  { key: "performance", label: "Performance", code: "PERF" },
  { key: "seo", label: "SEO", code: "SEO" },
  { key: "accessibility", label: "Accessibility", code: "A11Y" },
  { key: "bestPractices", label: "Best Practices", code: "BEST" },
];

interface GradeCardProps {
  score: number | null;
  grade: string;
  categoryScores: CategoryScores;
  scoreNote?: string;
}

export default function GradeCard({ score, grade, categoryScores, scoreNote }: GradeCardProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [countFinished, setCountFinished] = useState(false);
  const [barsAnimated, setBarsAnimated] = useState(false);

  // The grade appears as soon as the count finishes - or straight away when
  // there is no score to count up to.
  const showGrade = score === null || countFinished;
  const colour = GRADE_COLOURS[grade] ?? UNKNOWN_COLOUR;

  useEffect(() => {
    if (score === null) return;

    let frame = 0;
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / COUNT_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplayScore(Math.round(eased * score));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        setCountFinished(true);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  // Flip the bars on one tick after mount so their width transitions run.
  useEffect(() => {
    const timer = setTimeout(() => setBarsAnimated(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const ringProgress = score === null ? 0 : displayScore / 100;

  return (
    <section className="animate-fade-in">
      <TiltCard maxDegrees={3}>
        <div className="relative overflow-hidden rounded-3xl border border-line-strong bg-paper-2 p-7 shadow-[0_1px_2px_rgba(23,20,15,0.04),0_18px_40px_-28px_rgba(23,20,15,0.28)] sm:p-10">
          <span className="corner-ticks" aria-hidden="true" />

          <div className="relative flex flex-col items-center gap-9 sm:flex-row sm:items-center sm:gap-12">
            {/* The dial */}
            <div className="relative h-48 w-48 shrink-0">
              {/* Halo turning slowly behind the ring */}
              <div
                aria-hidden="true"
                className="absolute inset-1 animate-orbit rounded-full opacity-25"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0deg, ${colour} 120deg, transparent 240deg)`,
                }}
              />

              <svg viewBox="0 0 160 160" className="relative h-full w-full -rotate-90">
                {/* Tick marks around the dial */}
                {Array.from({ length: 40 }).map((_, tick) => (
                  <line
                    key={tick}
                    x1="80"
                    y1="4"
                    x2="80"
                    y2={tick % 5 === 0 ? "11" : "7"}
                    stroke="#cdc4b4"
                    strokeWidth="1"
                    transform={`rotate(${tick * 9} 80 80)`}
                  />
                ))}

                <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#e6dfd2" strokeWidth="10" />
                <circle
                  cx="80"
                  cy="80"
                  r={RADIUS}
                  fill="none"
                  stroke={colour}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - ringProgress)}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="font-mono text-5xl leading-none font-medium tabular-nums"
                  style={{ color: colour }}
                >
                  {score === null ? "--" : displayScore}
                </span>
                <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  {score === null ? "no score" : "of 100"}
                </span>
              </div>
            </div>

            {/* The reading */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
                Overall grade
              </p>

              {showGrade ? (
                <div className="mt-2 animate-scale-in">
                  <div className="flex items-baseline justify-center gap-4 sm:justify-start">
                    <span
                      className="text-6xl leading-none font-bold tracking-tight"
                      style={{ color: colour }}
                    >
                      {score === null ? "n/a" : grade}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.08em] text-ink-faint">
                      {score === null ? "speed test unavailable" : "average of four checks"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 h-16" aria-hidden="true" />
              )}

              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                {score === null
                  ? "We couldn't get a score for this one, so everything else is what we could still verify."
                  : "Mobile PageSpeed Insights, with all four categories averaged."}
              </p>

              {scoreNote && (
                <p className="mt-4 rounded-lg border border-signal-warn/30 bg-signal-warn/8 px-4 py-3 text-left font-mono text-[11px] leading-relaxed text-signal-warn">
                  {scoreNote}
                </p>
              )}
            </div>
          </div>

          {/* Category bars */}
          <div className="mt-10 grid gap-x-10 gap-y-5 border-t border-line pt-7 sm:grid-cols-2">
            {CATEGORIES.map(({ key, label, code }, position) => {
              const value = categoryScores[key];
              return (
                <div key={key}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                        {code}
                      </span>
                      <span className="text-sm font-medium text-ink">{label}</span>
                    </span>
                    <span className="font-mono text-sm tabular-nums text-ink-soft">
                      {value === null ? "--" : value}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-paper-3">
                    <div
                      className="h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        width: `${barsAnimated ? (value ?? 0) : 0}%`,
                        backgroundColor: colour,
                        transitionDelay: `${position * 120}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </TiltCard>
    </section>
  );
}
