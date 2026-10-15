/**
 * PageSpeed Insights check (Google).
 *
 * This is the slow one - it can take 10-30 seconds, so we give it a generous
 * timeout. The raw response is enormous (often 1MB+), so we only pull out the
 * four category scores and a handful of the weakest audits, which is all the
 * AI needs.
 */

import type { CategoryScores } from "@/lib/types";
import { fetchJson } from "@/lib/url";

/** Only the parts of the (huge) PageSpeed response that we actually use. */
interface LighthouseCategory {
  score?: number | null;
}

interface LighthouseAudit {
  title?: string;
  description?: string;
  displayValue?: string;
  score?: number | null;
  scoreDisplayMode?: string;
}

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: Record<string, LighthouseCategory | undefined>;
    audits?: Record<string, LighthouseAudit | undefined>;
  };
}

/** One audit that scored badly, in a shape that is small and AI-friendly. */
export interface WeakAudit {
  title: string;
  description: string;
  displayValue?: string;
  score: number;
}

export interface PageSpeedOutcome {
  categoryScores: CategoryScores;
  weakestAudits: WeakAudit[];
  /** false when the API call failed for any reason. */
  ok: boolean;
  /** Friendly explanation shown in the UI when something went wrong. */
  message?: string;
}

const EMPTY_SCORES: CategoryScores = {
  performance: null,
  seo: null,
  accessibility: null,
  bestPractices: null,
};

/**
 * Work out what actually went wrong, so the message we show is true.
 * A quota problem is not a timeout, and neither is a rejected key.
 */
function describeFailure(error: unknown): string {
  const detail = error instanceof Error ? error.message : "";

  if (/\b429\b|quota|rate limit/i.test(detail)) {
    return "PageSpeed Insights is rate limited right now, so this site couldn't be scored. The API key has probably hit its daily quota.";
  }

  if (/\b(400|401|403)\b|API key|API_KEY_INVALID|PERMISSION_DENIED|not authorized/i.test(detail)) {
    return "PageSpeed Insights rejected our API key, so this site couldn't be scored. Check that PAGESPEED_API_KEY is correct and that the PageSpeed Insights API is enabled for it.";
  }

  return "PageSpeed Insights didn't answer in time. This usually means the site is slow or temporarily unreachable.";
}

/** Audits with no numeric score can't be ranked, so we skip them. */
function hasNumericScore(
  audit: LighthouseAudit | undefined,
): audit is LighthouseAudit & { score: number } {
  return typeof audit?.score === "number";
}

/** Turn a Lighthouse 0-1 score into our 0-100 score. */
function toPercent(score: unknown): number | null {
  return typeof score === "number" && Number.isFinite(score) ? Math.round(score * 100) : null;
}

/** Lighthouse descriptions contain markdown links and newlines. Clean them up. */
function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) -> text
    .replace(/`([^`]+)`/g, "$1") // strip code ticks
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export async function runPageSpeed(url: string): Promise<PageSpeedOutcome> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return {
      categoryScores: EMPTY_SCORES,
      weakestAudits: [],
      ok: false,
      message: "The PageSpeed API key is not configured on the server.",
    };
  }

  const params = new URLSearchParams();
  params.set("url", url);
  params.set("key", apiKey);
  params.set("strategy", "mobile");
  // Repeated category params give us all four scores in a single request.
  for (const category of ["performance", "seo", "accessibility", "best-practices"]) {
    params.append("category", category);
  }

  let data: PageSpeedResponse;
  try {
    data = await fetchJson<PageSpeedResponse>(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
      { method: "GET" },
      // Generous, but deliberately under the 60s ceiling that Vercel's free
      // plan puts on a request, so a slow site fails politely instead of
      // being killed by the platform.
      40_000,
    );
  } catch (error) {
    return {
      categoryScores: EMPTY_SCORES,
      weakestAudits: [],
      ok: false,
      message: describeFailure(error),
    };
  }

  const categories = data.lighthouseResult?.categories ?? {};
  const categoryScores: CategoryScores = {
    performance: toPercent(categories.performance?.score),
    seo: toPercent(categories.seo?.score),
    accessibility: toPercent(categories.accessibility?.score),
    bestPractices: toPercent(categories["best-practices"]?.score),
  };

  // Collect every audit that has a numeric score and scored below 0.9,
  // then keep the six worst. Lighthouse "manual"/"informative" audits have no
  // score at all, so they are filtered out automatically here.
  const audits = data.lighthouseResult?.audits ?? {};
  const weakestAudits: WeakAudit[] = Object.values(audits)
    .filter(hasNumericScore)
    .filter(
      (audit) =>
        audit.score < 0.9 &&
        !["notApplicable", "informative", "manual", "error"].includes(
          audit.scoreDisplayMode ?? "",
        ),
    )
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map((audit) => ({
      title: cleanText(audit.title) || "Untitled audit",
      description: cleanText(audit.description),
      displayValue: typeof audit.displayValue === "string" ? audit.displayValue : undefined,
      score: audit.score,
    }));

  return { categoryScores, weakestAudits, ok: true };
}
