"use client";

/**
 * The written report: the verdict as an editorial pull-quote, then the issues
 * as numbered cards that rise into place one after another, then the closing
 * line on the accent.
 */

import Reveal from "@/components/Reveal";
import type { Report } from "@/lib/types";

export default function ReportSection({ report }: { report: Report }) {
  return (
    <section>
      {/* Section label */}
      <div className="mb-5 flex items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
          01 / Report
        </span>
        <span className="rule-dotted h-px flex-1" aria-hidden="true" />
      </div>

      {/* Verdict */}
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-line-strong bg-paper-2 px-7 py-9 shadow-[0_1px_2px_rgba(23,20,15,0.04)] sm:px-10 sm:py-11">
          <span className="corner-ticks" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-6 left-4 font-serif text-[7rem] leading-none text-[var(--accent)] opacity-15 select-none"
          >
            &ldquo;
          </span>
          <p className="relative font-serif text-2xl leading-[1.35] text-ink italic sm:text-[1.75rem]">
            {report.verdict}
          </p>
        </div>
      </Reveal>

      {/* Issues */}
      {report.issues.length > 0 && (
        <ol className="mt-5 space-y-4">
          {report.issues.map((issue, index) => (
            <li key={`${issue.title}-${index}`}>
              <Reveal delay={index * 90}>
                <article className="group relative overflow-hidden rounded-2xl border border-line bg-paper-2 p-6 transition-[transform,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-line-strong">
                  {/* Accent rule that grows on hover */}
                  <span
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 left-0 w-[3px] origin-top scale-y-0 bg-[var(--accent)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
                  />

                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--accent)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-lg leading-snug font-semibold text-ink">{issue.title}</h3>
                  </div>

                  <dl className="mt-5 grid gap-5 pl-0 sm:grid-cols-2 sm:pl-9">
                    {issue.why && (
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                          Why it matters
                        </dt>
                        <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{issue.why}</dd>
                      </div>
                    )}
                    {issue.fix && (
                      <div className="sm:border-l sm:border-line sm:pl-5">
                        <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                          What to do next
                        </dt>
                        <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{issue.fix}</dd>
                      </div>
                    )}
                  </dl>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      )}

      {/* Closing */}
      {report.closing && (
        <Reveal delay={report.issues.length * 90}>
          <p className="mt-5 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-7 py-6 text-center font-serif text-lg leading-snug text-ink italic">
            {report.closing}
          </p>
        </Reveal>
      )}

      {report.fallback && (
        <p className="mt-4 text-center font-mono text-[11px] leading-relaxed text-ink-faint">
          The written summary couldn&apos;t be generated this time, so we showed the raw
          findings instead.
        </p>
      )}
    </section>
  );
}
