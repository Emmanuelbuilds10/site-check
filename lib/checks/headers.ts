/**
 * Security headers check.
 *
 * These three headers are cheap protection against clickjacking and protocol
 * downgrade attacks. We keep this as a *minor* caution on purpose: a great many
 * legitimate small business sites do not set them.
 */

import type { TrustCheck } from "@/lib/types";

export const HEADERS_CHECK_NAME = "Security headers";

export function buildSecurityHeadersCheck(headers: Headers, finalUrl: string): TrustCheck {
  const name = HEADERS_CHECK_NAME;
  const isHttps = new URL(finalUrl).protocol === "https:";

  const hasHsts = Boolean(headers.get("strict-transport-security"));
  const hasNosniff = (headers.get("x-content-type-options") ?? "")
    .toLowerCase()
    .includes("nosniff");
  const hasFrameProtection =
    Boolean(headers.get("x-frame-options")) ||
    /frame-ancestors/i.test(headers.get("content-security-policy") ?? "");

  const missing: string[] = [];
  if (!hasHsts && isHttps) missing.push("Strict-Transport-Security");
  if (!hasNosniff) missing.push("X-Content-Type-Options");
  if (!hasFrameProtection) missing.push("X-Frame-Options");

  if (missing.length === 0) {
    return {
      name,
      status: "ok",
      detail: "All the security headers we look for are set. Nice work.",
    };
  }

  if (missing.length === 1) {
    return {
      name,
      status: "ok",
      detail: `Almost all set - only ${missing[0]} is missing, which is a very minor thing.`,
    };
  }

  return {
    name,
    status: "caution",
    detail: `${missing.length} of 3 are missing (${missing.join(
      ", ",
    )}). This is a minor issue only - lots of legitimate small sites don't set these.`,
  };
}
