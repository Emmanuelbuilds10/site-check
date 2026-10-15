/**
 * Domain age check, using RDAP (the modern, JSON version of WHOIS).
 *
 * A domain that was registered a few weeks ago is not automatically bad, but
 * brand-new domains are a common pattern in throwaway scam sites, so it is a
 * useful signal. If RDAP has nothing for us we say "unknown" - never a red flag.
 */

import type { TrustCheck } from "@/lib/types";
import { fetchSite } from "@/lib/url";

export const DOMAIN_AGE_CHECK_NAME = "Domain age";

export interface DomainAgeOutcome {
  check: TrustCheck;
  /** Age of the domain in months, or null when we couldn't work it out. */
  months: number | null;
}

/**
 * Turn "shop.example.co.uk" into "example.co.uk".
 * RDAP is published per registry, and registries live at the root domain.
 */
const MULTI_PART_SUFFIXES = [
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk",
  "com.au", "net.au", "org.au",
  "co.nz", "org.nz",
  "co.za", "org.za",
  "com.ng", "org.ng", "ng",
  "com.br", "com.mx",
  "co.in", "co.jp", "co.ke", "com.gh", "com.sg", "co.id",
];

export function getRootDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;

  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_SUFFIXES.includes(lastTwo)) {
    return parts.slice(-3).join(".");
  }

  return lastTwo;
}

/** Only the bits of the RDAP response we use. */
interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapResponse {
  events?: RdapEvent[];
}

/** Ask RDAP about one domain. Returns the registration date, or null. */
async function lookupRegistrationDate(domain: string): Promise<Date | null> {
  const response = await fetchSite(new URL(`https://rdap.org/domain/${domain}`), {
    timeoutMs: 15_000,
    maxBytes: 256 * 1024,
  });

  if (response.status >= 400) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const data = parsed as RdapResponse;

  // Different registries word this differently, so accept both spellings.
  const events = Array.isArray(data.events) ? data.events : [];
  const registration = events.find((event) =>
    ["registration", "registered"].includes(String(event?.eventAction ?? "").toLowerCase()),
  );

  const eventDate = registration?.eventDate;
  if (!eventDate) return null;

  const date = new Date(eventDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "3 months", "1 year 4 months" - nicer than raw day counts. */
function humanAge(months: number): string {
  if (months < 1) return "less than a month";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0
    ? `${years} year${years === 1 ? "" : "s"}`
    : `${years} year${years === 1 ? "" : "s"} ${rest} month${rest === 1 ? "" : "s"}`;
}

export async function runDomainAge(hostname: string): Promise<DomainAgeOutcome> {
  const rootDomain = getRootDomain(hostname);

  let registrationDate: Date | null = null;
  try {
    // Try the root domain first (what registries publish), then the exact host.
    registrationDate = await lookupRegistrationDate(rootDomain);
    if (!registrationDate && rootDomain !== hostname) {
      registrationDate = await lookupRegistrationDate(hostname);
    }
  } catch {
    registrationDate = null;
  }

  if (!registrationDate) {
    return {
      months: null,
      check: {
        name: DOMAIN_AGE_CHECK_NAME,
        status: "unknown",
        detail: "Could not check - no public registration record was available for this domain.",
      },
    };
  }

  const days = (Date.now() - registrationDate.getTime()) / (1000 * 60 * 60 * 24);
  const months = Math.max(0, Math.floor(days / 30.44));
  const registeredOn = registrationDate.toISOString().slice(0, 10);

  if (months < 6) {
    return {
      months,
      check: {
        name: DOMAIN_AGE_CHECK_NAME,
        status: "red_flag",
        detail: `This domain was first registered ${humanAge(months)} ago (${registeredOn}). Very new domains deserve extra care.`,
      },
    };
  }

  if (months < 12) {
    return {
      months,
      check: {
        name: DOMAIN_AGE_CHECK_NAME,
        status: "caution",
        detail: `This domain was registered ${humanAge(months)} ago (${registeredOn}), so it is still fairly new.`,
      },
    };
  }

  return {
    months,
    check: {
      name: DOMAIN_AGE_CHECK_NAME,
      status: "ok",
      detail: `This domain has been registered for ${humanAge(months)} (since ${registeredOn}).`,
    },
  };
}
