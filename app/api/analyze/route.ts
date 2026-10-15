/**
 * POST /api/analyze
 *
 * This route only ever runs on the server, which is what keeps the API keys
 * hidden from the browser. It accepts { url, mode } and returns the full
 * analysis as JSON.
 *
 * Every request is checked before any work happens: who is calling (rate
 * limit), what they sent (content type), and how big it is (size cap). Only
 * then do we spend API quota on the analysis.
 */

import { NextResponse } from "next/server";
import { analyzeSite } from "@/lib/analyze";
import { UrlError } from "@/lib/url";
import { checkRateLimit, visitorKey } from "@/lib/rateLimit";
import type { Mode } from "@/lib/types";

// Route handlers run on the Node.js runtime by default, which we need for the
// dns, net and tls modules used by the SSRF guard and the SSL check.

// PageSpeed Insights can take 10-30 seconds, so allow up to a minute.
// (60s is the maximum allowed on Vercel's free Hobby plan.)
export const maxDuration = 60;

/** A real request is about 60 bytes. Anything bigger is not our frontend. */
const MAX_BODY_BYTES = 2_048;

export async function POST(request: Request) {
  // --- Rate limit, before anything expensive -------------------------------
  const limit = checkRateLimit(visitorKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "That's a lot of checks in a row. Please wait a few minutes and try again.",
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  // --- Only accept JSON ----------------------------------------------------
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Please send this request as JSON." },
      { status: 415 },
    );
  }

  // --- Refuse oversized bodies --------------------------------------------
  // Checked twice: the declared length is a hint, the real text is the truth.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "That request was too large." },
      { status: 413 },
    );
  }

  let payload: { url?: unknown; mode?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "That request was too large." },
        { status: 413 },
      );
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "We couldn't read that request. Please try again." },
      { status: 400 },
    );
  }

  const mode: Mode = payload?.mode === "roast" ? "roast" : "friendly";

  // --- Run the analysis ----------------------------------------------------
  try {
    const result = await analyzeSite({ url: payload?.url, mode });
    return NextResponse.json(result);
  } catch (error) {
    // Anything the user can fix (bad address, unreachable site, blocked host).
    if (error instanceof UrlError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    // Full details stay in the server log; the visitor gets a calm message.
    console.error("[site-check] Unexpected failure in /api/analyze:", error);
    return NextResponse.json(
      { ok: false, error: "Something went wrong on our side. Please try again in a moment." },
      { status: 500 },
    );
  }
}
