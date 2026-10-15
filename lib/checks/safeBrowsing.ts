/**
 * Google Safe Browsing check.
 *
 * We ask Google whether this exact URL is on any of its threat lists.
 * Any match at all is the most serious signal this app can find.
 */

import type { TrustCheck } from "@/lib/types";
import { fetchJson } from "@/lib/url";

export const SAFE_BROWSING_CHECK_NAME = "Google Safe Browsing";

export interface SafeBrowsingOutcome {
  check: TrustCheck;
  /** true when Google returned at least one threat match. */
  matched: boolean;
}

type SafeBrowsingResponse = {
  matches?: { threatType?: string; platformType?: string }[];
};

export async function runSafeBrowsing(url: string): Promise<SafeBrowsingOutcome> {
  const apiKey = process.env.SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    return {
      matched: false,
      check: {
        name: SAFE_BROWSING_CHECK_NAME,
        status: "unknown",
        detail: "Could not check - the Safe Browsing API key is not configured on the server.",
      },
    };
  }

  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`;

  const body = {
    client: { clientId: "site-check", clientVersion: "1.0.0" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url }],
    },
  };

  try {
    const data = await fetchJson<SafeBrowsingResponse>(
      endpoint,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      15_000,
    );

    const matches = data.matches ?? [];
    if (matches.length === 0) {
      return {
        matched: false,
        check: {
          name: SAFE_BROWSING_CHECK_NAME,
          status: "ok",
          detail: "This address is not currently on Google's lists of unsafe sites.",
        },
      };
    }

    const threatTypes = Array.from(
      new Set(matches.map((match) => match.threatType).filter(Boolean)),
    ).join(", ");

    return {
      matched: true,
      check: {
        name: SAFE_BROWSING_CHECK_NAME,
        status: "red_flag",
        detail: `Google lists this address for: ${threatTypes || "a known threat"}. Do not enter personal details or payment information here.`,
      },
    };
  } catch (error) {
    // A rejected key is worth saying out loud - it is the most common setup
    // mistake, and it looks nothing like a temporary outage.
    const detail = error instanceof Error ? error.message : "";
    const keyRejected = /\b(400|401|403)\b|API key|API_KEY_INVALID|PERMISSION_DENIED|not authorized/i.test(
      detail,
    );

    return {
      matched: false,
      check: {
        name: SAFE_BROWSING_CHECK_NAME,
        status: "unknown",
        detail: keyRejected
          ? "Could not check - Google rejected our Safe Browsing API key. Check that SAFE_BROWSING_API_KEY is correct and that the Safe Browsing API is enabled for it."
          : "Could not check - Google's Safe Browsing service didn't respond.",
      },
    };
  }
}
