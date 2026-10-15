/**
 * Shared types for Site Check.
 * Everything the API sends back is described here, so the frontend and the
 * backend always agree on the shape of the data.
 */

/** The two report personalities. */
export type Mode = "friendly" | "roast";

/**
 * How each trust check turned out.
 * - "ok"       -> no problem found
 * - "caution"  -> something worth knowing, but not scary
 * - "red_flag" -> a strong warning sign
 * - "unknown"  -> we could not run the check (shown as "Could not check")
 */
export type CheckStatus = "ok" | "caution" | "red_flag" | "unknown";

/** The three possible overall trust levels. */
export type TrustLevel = "No red flags found" | "Some caution signs" | "Multiple red flags";

/** One line of the trust & safety checklist. */
export interface TrustCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

/** The four PageSpeed Insights category scores (0-100, or null if unavailable). */
export interface CategoryScores {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
}

/** One problem card in the written report. */
export interface ReportIssue {
  title: string;
  why: string;
  fix: string;
}

/** The AI-written part of the report. */
export interface Report {
  verdict: string;
  issues: ReportIssue[];
  closing: string;
  /** true when the AI reply could not be parsed and we used safe fallback text. */
  fallback?: boolean;
}

/** The AI-written part of the trust section. */
export interface TrustSummary {
  level: TrustLevel;
  checks: TrustCheck[];
  summary: string;
  advice: string[];
  /** true when the AI reply could not be parsed and we used safe fallback text. */
  fallback?: boolean;
}

/** What the API returns when the analysis worked. */
export interface AnalyzeSuccess {
  ok: true;
  mode: Mode;
  /** The URL exactly as we normalized it (after adding https:// etc). */
  url: string;
  /** Where the site actually ended up after any redirects. */
  finalUrl: string;
  /** Average of the four category scores, rounded. null if PageSpeed failed. */
  score: number | null;
  /** "A" | "B" | "C" | "D" | "F", or "?" when no score is available. */
  grade: string;
  categoryScores: CategoryScores;
  /** Set when the score could not be worked out, explaining why. */
  scoreNote?: string;
  report: Report;
  trust: TrustSummary;
}

/** What the API returns when something went wrong. */
export interface AnalyzeFailure {
  ok: false;
  error: string;
}

export type AnalyzeResult = AnalyzeSuccess | AnalyzeFailure;
