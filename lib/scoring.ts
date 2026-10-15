/**
 * Scoring rules.
 *
 * IMPORTANT: every number and every grade in this app is worked out here, in
 * plain code. The AI only ever writes words - it never decides a score or a
 * trust level. That keeps the results consistent and repeatable.
 */

import type { CategoryScores, TrustCheck, TrustLevel } from "@/lib/types";

/** Overall score = average of the category scores we actually got back. */
export function averageScore(scores: CategoryScores): number | null {
  const values = [scores.performance, scores.seo, scores.accessibility, scores.bestPractices].filter(
    (value): value is number => typeof value === "number",
  );

  if (values.length === 0) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

/** 90+ = A, 80+ = B, 70+ = C, 60+ = D, below that = F. */
export function gradeForScore(score: number | null): string {
  if (score === null) return "?";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Overall trust level.
 *  - a Safe Browsing match, or 2+ red flags  -> "Multiple red flags"
 *  - 1 red flag, or 2+ cautions              -> "Some caution signs"
 *  - anything else                           -> "No red flags found"
 */
export function trustLevel(checks: TrustCheck[], safeBrowsingMatched: boolean): TrustLevel {
  if (safeBrowsingMatched) return "Multiple red flags";

  const redFlags = checks.filter((check) => check.status === "red_flag").length;
  const cautions = checks.filter((check) => check.status === "caution").length;

  if (redFlags >= 2) return "Multiple red flags";
  if (redFlags === 1 || cautions >= 2) return "Some caution signs";
  return "No red flags found";
}
