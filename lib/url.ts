/**
 * URL helpers + the SSRF guard.
 *
 * Because this app fetches URLs that come from the user, we must never let
 * someone point us at our own server, at the local network, or at cloud
 * metadata endpoints. Everything that leaves the server goes through
 * `fetchSite()`, which validates the host (and every redirect hop) first.
 */

import dns from "node:dns/promises";
import net from "node:net";

/** Error caused by the user's input (bad URL, blocked host, unreachable). */
export class UrlError extends Error {}

/** How many redirects we are willing to follow before giving up. */
const MAX_REDIRECTS = 5;

/** We never read more than 512 KB of a page. Homepages are rarely bigger. */
const DEFAULT_MAX_BYTES = 512 * 1024;

/** Ceiling for our own trusted API calls, so nothing can balloon our memory. */
const MAX_API_RESPONSE_BYTES = 12 * 1024 * 1024;

/** A honest, descriptive User-Agent so site owners know who visited. */
export const SITE_CHECK_USER_AGENT =
  "SiteCheckBot/1.0 (+https://github.com/emmanuel/site-check; website audit tool)";

/** Hostnames that always point at private or local machines. */
const BLOCKED_HOSTNAMES = /^(localhost|.+\.localhost|.+\.local|.+\.internal|.+\.home\.arpa)$/i;

/**
 * Turn whatever the user typed into a proper URL object.
 * If they left out the protocol we assume https://.
 */
export function normalizeUrl(input: unknown): URL {
  if (typeof input !== "string" || input.trim() === "") {
    throw new UrlError("Please enter a website address to check.");
  }

  const trimmed = input.trim();

  // Has the user typed a protocol already? If not, add https:// for them.
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new UrlError(
      `That doesn't look like a website address. Try something like example.com`,
    );
  }

  // Only normal web pages please - no file://, ftp://, javascript:// ...
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlError("Only http:// and https:// addresses can be checked.");
  }

  // A public website always has a dot in its name (example.com).
  // Note: Node's URL parser has already normalized sneaky IP formats such as
  // http://2130706433/ or http://0x7f.0x0.0x1/ into "127.0.0.1", which the
  // IP checks below will then catch.
  if (!url.hostname.includes(".")) {
    throw new UrlError(`"${trimmed}" doesn't look like a public website address.`);
  }

  url.hash = ""; // fragments never matter to a server
  return url;
}

/** True for anything that is NOT a normal public internet address. */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true; // this network / private / loopback
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier grade NAT
    if (a === 192 && (b === 0 || b === 2)) return true; // reserved / TEST-NET
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return true; // benchmarking / docs
    if (a === 203 && b === 0) return true; // docs
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const value = ip.toLowerCase();
    // IPv4-mapped IPv6 (::ffff:127.0.0.1) - check the IPv4 part instead.
    if (value.startsWith("::ffff:")) return isPrivateIp(value.slice(7));
    if (value === "::" || value === "::1") return true; // unspecified / loopback
    const first = parseInt(value.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
    return false;
  }

  // Not an IP we understand - refuse it.
  return true;
}

/**
 * Make sure a hostname resolves to a public IP address.
 * We check both the literal name and every DNS record it resolves to.
 */
export async function assertHostIsPublic(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UrlError("That address points to a private network, so it can't be checked.");
    }
    return;
  }

  if (BLOCKED_HOSTNAMES.test(hostname)) {
    throw new UrlError("Local and private addresses can't be checked.");
  }

  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UrlError(
      "We couldn't find that website. Please check the spelling of the address and try again.",
    );
  }

  if (records.length === 0) {
    throw new UrlError("We couldn't find that website. Please check the address and try again.");
  }

  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new UrlError("That website points to a private network, so it can't be checked.");
    }
  }
}

/** Read a response body but stop after `maxBytes`, so a huge file can't hurt us. */
export async function readBodyLimited(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) {
    return { text: "", truncated: false };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    chunks.push(value);
    total += value.byteLength;

    if (total >= maxBytes) {
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        // Already closed - nothing to do.
      }
      break;
    }
  }

  const combined = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return { text: combined.subarray(0, maxBytes).toString("utf8"), truncated };
}

/** How a redirect status is judged. */
function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/** The result of a guarded fetch. */
export interface SiteResponse {
  /** Where we ended up after following redirects. */
  finalUrl: string;
  /** Every URL we were redirected to, in order. */
  redirects: string[];
  status: number;
  headers: Headers;
  /** The page body, truncated to `maxBytes`. */
  body: string;
  truncated: boolean;
}

/** Friendly text for the different ways a network request can fail. */
function unreachableMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "That website took too long to respond. It may be offline right now.";
  }
  return "We couldn't reach that website. Double-check the address and try again.";
}

/**
 * Fetch a user-supplied URL safely.
 *
 * Safety measures:
 *  - the host (and every redirect host) must resolve to a public IP
 *  - only http/https is allowed
 *  - every hop has its own timeout
 *  - the body is capped at `maxBytes`
 */
export async function fetchSite(
  startUrl: URL,
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<SiteResponse> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  const redirects: string[] = [];
  let current = new URL(startUrl.toString());

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertHostIsPublic(current.hostname);

    // One AbortController per hop, always cleared in the finally block.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(current, {
        redirect: "manual", // we follow redirects ourselves so we can vet each hop
        signal: controller.signal,
        headers: {
          "user-agent": SITE_CHECK_USER_AGENT,
          accept: "text/html,application/xhtml+xml",
        },
      });

      const location = response.headers.get("location");
      if (isRedirect(response.status) && location) {
        try {
          await response.body?.cancel();
        } catch {
          // Ignore - we are moving on anyway.
        }

        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new UrlError("That website sent us to a malformed address.");
        }

        if (next.protocol !== "http:" && next.protocol !== "https:") {
          throw new UrlError("That website tried to redirect us to a non-web address.");
        }

        redirects.push(next.toString());
        current = next;
        continue;
      }

      const { text, truncated } = await readBodyLimited(response, maxBytes);
      return {
        finalUrl: current.toString(),
        redirects,
        status: response.status,
        headers: response.headers,
        body: text,
        truncated,
      };
    } catch (error) {
      if (error instanceof UrlError) throw error;
      throw new UrlError(unreachableMessage(error));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new UrlError("That website redirected too many times, so we stopped following it.");
}

/**
 * A simple JSON fetch for our *trusted* API calls (PageSpeed, Safe Browsing,
 * RDAP). It only adds a timeout - no SSRF checks, because the URLs are ours.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    // PageSpeed answers are big (often 1MB+), but they are never this big.
    const { text } = await readBodyLimited(response, MAX_API_RESPONSE_BYTES);

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
    }

    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}
