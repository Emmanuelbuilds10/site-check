/**
 * A small, best-effort rate limiter.
 *
 * Every analysis spends real API quota (PageSpeed, Safe Browsing and Gemini),
 * so we must not let one visitor hammer the endpoint and burn it.
 *
 * HONEST LIMITATION: this keeps its counters in the memory of a single server
 * instance. On Vercel each serverless instance has its own memory, so a
 * determined visitor could get a few extra requests by landing on different
 * instances. It still stops the realistic cases - a script on one machine, a
 * stuck retry loop, someone holding down Enter. If you need a hard guarantee,
 * swap the Map below for a shared store (a hosted Redis or KV).
 */

/** How long one visitor's budget lasts. */
const WINDOW_MS = 10 * 60 * 1000;

/** How many analyses one visitor may start inside that window. */
const MAX_REQUESTS = 15;

/** Never let the map itself grow without limit. */
const MAX_TRACKED_VISITORS = 5_000;

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait, for the Retry-After header. */
  retryAfterSeconds: number;
}

export function checkRateLimit(visitor: string): RateLimitResult {
  const now = Date.now();
  const recent = (hits.get(visitor) ?? []).filter((time) => now - time < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    hits.set(visitor, recent);
    const oldest = recent[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  hits.set(visitor, recent);

  // Occasionally sweep out visitors whose window has passed.
  if (hits.size > MAX_TRACKED_VISITORS) {
    for (const [key, times] of hits) {
      if (times.every((time) => now - time > WINDOW_MS)) hits.delete(key);
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best guess at who is calling, for grouping requests. */
export function visitorKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return request.headers.get("x-real-ip") ?? "local";
}
