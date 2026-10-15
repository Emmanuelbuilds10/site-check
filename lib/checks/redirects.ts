/**
 * Redirect check.
 * If visitors end up on a different domain than the one that was typed in,
 * they should at least be told about it.
 */

import type { TrustCheck } from "@/lib/types";

export const REDIRECT_CHECK_NAME = "Where the address leads";

/** Treat "www.example.com" and "example.com" as the same site. */
function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function buildRedirectsCheck(
  startUrl: URL,
  finalUrl: string,
  redirects: string[],
): TrustCheck {
  const name = REDIRECT_CHECK_NAME;
  const startHost = bareHost(startUrl.hostname);

  let final: URL;
  try {
    final = new URL(finalUrl);
  } catch {
    return {
      name,
      status: "unknown",
      detail: "Could not check - the final address of this site could not be read.",
    };
  }

  const finalHost = bareHost(final.hostname);

  if (redirects.length === 0) {
    return {
      name,
      status: "ok",
      detail: `The address stays on ${startHost} with no redirects.`,
    };
  }

  if (startHost === finalHost) {
    return {
      name,
      status: "ok",
      detail: `It redirects ${redirects.length} time${
        redirects.length === 1 ? "" : "s"
      }, but visitors still end up on ${finalHost}.`,
    };
  }

  return {
    name,
    status: "caution",
    detail: `You entered ${startHost}, but visitors actually land on ${finalHost}. That is normal after a rebrand or a move - just make sure it is where you meant to send them.`,
  };
}
