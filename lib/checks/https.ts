/**
 * HTTPS and SSL check.
 * Combines "did we end up on https?" with the actual certificate inspection.
 */

import type { TrustCheck } from "@/lib/types";
import type { TlsInfo } from "@/lib/checks/tls";

export const HTTPS_CHECK_NAME = "HTTPS and SSL certificate";

export function buildHttpsCheck(
  finalUrl: string,
  tlsInfo: TlsInfo | null,
  tlsError: string | null,
): TrustCheck {
  const name = HTTPS_CHECK_NAME;

  // No HTTPS at all: the clearest technical warning sign we can report.
  if (new URL(finalUrl).protocol !== "https:") {
    return {
      name,
      status: "red_flag",
      detail:
        "This site loads over plain http://, so anything typed into it travels unencrypted. That matters a lot before paying or sharing personal details.",
    };
  }

  // HTTPS worked but we could not read the certificate.
  if (!tlsInfo) {
    return {
      name,
      status: "unknown",
      detail: `Could not check - the secure connection couldn't be inspected${
        tlsError ? ` (${tlsError})` : ""
      }.`,
    };
  }

  if (tlsInfo.expired) {
    return {
      name,
      status: "red_flag",
      detail: `The security certificate expired on ${formatDate(tlsInfo.validTo)}. Your browser may show a warning page to visitors.`,
    };
  }

  if (!tlsInfo.authorized) {
    return {
      name,
      status: "red_flag",
      detail: `The certificate could not be verified by a trusted authority${
        tlsInfo.authorizationError ? ` (${tlsInfo.authorizationError})` : ""
      }. Visitors may see a "not secure" warning.`,
    };
  }

  return {
    name,
    status: "ok",
    detail: `The site uses HTTPS and its certificate is valid until ${formatDate(tlsInfo.validTo)}.`,
  };
}

/** "12 Mar 2027" - readable and locale-independent. */
function formatDate(value: string | null): string {
  if (!value) return "an unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "an unknown date";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
