/**
 * The orchestrator: runs every check, then assembles the final response.
 *
 * Flow:
 *   1. normalize + validate the URL
 *   2. run all the network checks in parallel with Promise.allSettled
 *   3. build the trust checklist and score everything in code
 *   4. ask Gemini for the report and the trust summary, in parallel
 */

import type {
  AnalyzeSuccess,
  CategoryScores,
  CheckStatus,
  Mode,
  TrustCheck,
  TrustSummary,
} from "@/lib/types";
import { assertHostIsPublic, fetchSite, normalizeUrl, UrlError } from "@/lib/url";
import { runPageSpeed, type WeakAudit } from "@/lib/checks/pagespeed";
import { runSafeBrowsing, SAFE_BROWSING_CHECK_NAME } from "@/lib/checks/safeBrowsing";
import { runDomainAge, getRootDomain, DOMAIN_AGE_CHECK_NAME } from "@/lib/checks/domainAge";
import { inspectCertificate, type TlsInfo } from "@/lib/checks/tls";
import { buildHttpsCheck } from "@/lib/checks/https";
import { buildRedirectsCheck } from "@/lib/checks/redirects";
import { buildSecurityHeadersCheck, HEADERS_CHECK_NAME } from "@/lib/checks/headers";
import { buildTrustSignalsCheck, TRUST_SIGNALS_CHECK_NAME } from "@/lib/checks/trustSignals";
import { averageScore, gradeForScore, trustLevel } from "@/lib/scoring";
import { generateReport, generateTrustSummary } from "@/lib/gemini";

const EMPTY_SCORES: CategoryScores = {
  performance: null,
  seo: null,
  accessibility: null,
  bestPractices: null,
};

/** Everything we learn from one visit to the site's homepage. */
interface SiteOutcome {
  finalUrl: string;
  redirects: string[];
  status: number;
  headers: Headers;
  html: string;
  tls: TlsInfo | null;
  tlsError: string | null;
}

/**
 * Fetch the homepage and inspect its certificate.
 * Both parts are wrapped so a certificate problem still leaves us the HTML.
 */
async function inspectSite(url: URL): Promise<SiteOutcome> {
  const response = await fetchSite(url, { timeoutMs: 10_000, maxBytes: 512 * 1024 });

  let tls: TlsInfo | null = null;
  let tlsError: string | null = null;

  if (new URL(response.finalUrl).protocol === "https:") {
    try {
      tls = await inspectCertificate(new URL(response.finalUrl).hostname);
    } catch (error) {
      tlsError = error instanceof Error ? error.message : "the secure connection failed";
    }
  }

  return {
    finalUrl: response.finalUrl,
    redirects: response.redirects,
    status: response.status,
    headers: response.headers,
    html: response.body,
    tls,
    tlsError,
  };
}

/** Build a check, but never let a broken builder take the whole report down. */
function safeCheck(name: string, build: () => TrustCheck): TrustCheck {
  try {
    return build();
  } catch (error) {
    console.error(`[site-check] "${name}" check failed:`, error);
    return { name, status: "unknown", detail: "Could not check - something went wrong on our side." };
  }
}

export async function analyzeSite(input: { url: unknown; mode: Mode }): Promise<AnalyzeSuccess> {
  const mode: Mode = input.mode === "roast" ? "roast" : "friendly";

  // Our whole budget for the request. Vercel's free plan stops a function at
  // 60 seconds, so we aim to finish before that and still return a real answer.
  const aiDeadline = Date.now() + 55_000;

  // ---- Step 1 & 2: validate the URL, then make sure it is public ----------
  const startUrl = normalizeUrl(input.url);
  await assertHostIsPublic(startUrl.hostname);

  // ---- Step 3: run every check in parallel -------------------------------
  // allSettled (not all) so one failure can never break the rest.
  const [pageSpeedResult, safeBrowsingResult, domainAgeResult, siteResult] =
    await Promise.allSettled([
      runPageSpeed(startUrl.toString()),
      runSafeBrowsing(startUrl.toString()),
      runDomainAge(startUrl.hostname),
      inspectSite(startUrl),
    ]);

  // If the homepage itself is unreachable there is nothing useful to report.
  if (siteResult.status === "rejected") {
    const reason = siteResult.reason;
    if (reason instanceof UrlError) throw reason;
    throw new UrlError("We couldn't reach that website. Double-check the address and try again.");
  }

  const site = siteResult.value;

  // ---- Step 4a: trust checklist (all graded in code) ----------------------
  const checks: TrustCheck[] = [];

  // B) Safe Browsing
  const safeBrowsingMatched =
    safeBrowsingResult.status === "fulfilled" ? safeBrowsingResult.value.matched : false;
  checks.push(
    safeBrowsingResult.status === "fulfilled"
      ? safeBrowsingResult.value.check
      : {
          name: SAFE_BROWSING_CHECK_NAME,
          status: "unknown",
          detail: "Could not check - Google's Safe Browsing service didn't respond.",
        },
  );

  // C) Domain age
  checks.push(
    domainAgeResult.status === "fulfilled"
      ? domainAgeResult.value.check
      : {
          name: DOMAIN_AGE_CHECK_NAME,
          status: "unknown",
          detail: "Could not check - no public registration record was available for this domain.",
        },
  );

  // D) HTTPS and SSL
  checks.push(
    safeCheck("HTTPS and SSL certificate", () =>
      buildHttpsCheck(site.finalUrl, site.tls, site.tlsError),
    ),
  );

  // E) Redirects
  checks.push(
    safeCheck("Where the address leads", () =>
      buildRedirectsCheck(startUrl, site.finalUrl, site.redirects),
    ),
  );

  // F) Security headers
  checks.push(
    safeCheck(HEADERS_CHECK_NAME, () => buildSecurityHeadersCheck(site.headers, site.finalUrl)),
  );

  // G) Trust signals - only meaningful if the homepage actually loaded.
  if (site.status >= 400) {
    checks.push({
      name: TRUST_SIGNALS_CHECK_NAME,
      status: "unknown",
      detail: `Could not check - the homepage answered with an error page (HTTP ${site.status}).`,
    });
  } else {
    checks.push(safeCheck(TRUST_SIGNALS_CHECK_NAME, () => buildTrustSignalsCheck(site.html)));
  }

  // ---- Step 4b: scores and levels ---------------------------------------
  const categoryScores =
    pageSpeedResult.status === "fulfilled" ? pageSpeedResult.value.categoryScores : EMPTY_SCORES;
  const weakestAudits: WeakAudit[] =
    pageSpeedResult.status === "fulfilled" ? pageSpeedResult.value.weakestAudits : [];

  const score = averageScore(categoryScores);
  const grade = gradeForScore(score);
  const level = trustLevel(checks, safeBrowsingMatched);

  const scoreNote =
    score === null
      ? pageSpeedResult.status === "fulfilled"
        ? (pageSpeedResult.value.message ??
          "Could not check this site's speed - PageSpeed Insights had no scores for it.")
        : "Could not check this site's speed - PageSpeed Insights didn't respond."
      : undefined;

  // ---- Step 5: the two Gemini calls, in parallel -------------------------
  const reportData = {
    site: site.finalUrl,
    overallScore: score,
    grade,
    categoryScores,
    weakestAudits,
    // Say plainly what we do and don't have. Without this the writer can invent
    // performance problems that were never measured.
    performanceDataAvailable:
      pageSpeedResult.status === "fulfilled" && pageSpeedResult.value.ok,
    dataNote: score === null
      ? "The speed test did not run, so there is NO performance data. Do not invent speed or performance problems. Write the report from the trust signals alone, and mention that the speed test could not be completed."
      : weakestAudits.length === 0
        ? "The speed test ran and found no failing audits. Do not invent problems. If there is genuinely nothing to fix, return fewer issues."
        : "Speed data was measured by Google PageSpeed Insights on a mobile connection.",
    trustLevel: level,
    trustChecks: checks.map(({ name, status, detail }) => ({ name, status, detail })),
  };

  const trustData = {
    site: site.finalUrl,
    domain: getRootDomain(new URL(site.finalUrl).hostname),
    domainAgeMonths:
      domainAgeResult.status === "fulfilled" ? domainAgeResult.value.months : null,
    safeBrowsingMatch: safeBrowsingMatched,
    checks: checks.map(({ name, status, detail }) => ({ name, status, detail })),
    statusMeaning: {
      ok: "no problem found",
      caution: "worth knowing about",
      red_flag: "strong warning sign",
      unknown: "could not be checked",
    } satisfies Record<CheckStatus, string>,
  };

  const [report, aiTrust] = await Promise.all([
    generateReport(reportData, mode, aiDeadline),
    generateTrustSummary(trustData, aiDeadline),
  ]);

  const trust: TrustSummary = {
    level,
    checks,
    summary: aiTrust.summary,
    advice: aiTrust.advice,
    fallback: aiTrust.fallback,
  };

  // ---- Step 6: hand it all back to the frontend --------------------------
  return {
    ok: true,
    mode,
    url: startUrl.toString(),
    finalUrl: site.finalUrl,
    score,
    grade,
    categoryScores,
    scoreNote,
    report,
    trust,
  };
}
