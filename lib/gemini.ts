/**
 * Gemini calls.
 *
 * The API is called over plain REST (no SDK needed) with the key sent in a
 * header, so it never appears in a URL or in logs. Both prompts ask for JSON
 * only, and we always parse defensively: strip code fences, wrap in try/catch,
 * and fall back to a calm message if the model misbehaves.
 */

import type { Mode, Report, ReportIssue } from "@/lib/types";
import { readBodyLimited } from "@/lib/url";

/** The AI-written half of the trust section. The level and checklist are added by our own code. */
export interface AiTrustSummary {
  summary: string;
  advice: string[];
  fallback?: boolean;
}

/**
 * Default model. Google releases new Flash models often, so this is
 * configurable with the GEMINI_MODEL env var. Current stable Flash at the time
 * of writing is gemini-3.8-flash.
 */
const DEFAULT_MODEL = "gemini-3.8-flash";

/**
 * Google's newest Flash models sometimes answer with "this model is currently
 * experiencing high demand" (HTTP 503), or the key's quota for one model runs
 * out (HTTP 429). 3.5 Flash-Lite is the model Google's docs recommend for new
 * projects and it stays available when the newest model is congested, so it is
 * a good safety net. Override with GEMINI_FALLBACK_MODEL, or set that to
 * "none" to turn the fallback off.
 */
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

/** Read an env var, or use the given default when it is missing or blank. */
function envValue(name: string, fallback: string): string {
  const configured = process.env[name]?.trim();
  return configured ? configured : fallback;
}

export function geminiModel(): string {
  return envValue("GEMINI_MODEL", DEFAULT_MODEL);
}

/** The model to try when the main one is unavailable (null = don't). */
function geminiFallbackModel(): string | null {
  const model = envValue("GEMINI_FALLBACK_MODEL", DEFAULT_FALLBACK_MODEL);
  if (model.toLowerCase() === "none" || model === geminiModel()) return null;
  return model;
}

/** Statuses worth another attempt: model busy, rate limited, or renamed. */
const RETRYABLE_STATUSES = [404, 429, 500, 502, 503, 504];

/** Keep every single attempt short, so one slow model can't eat the budget. */
const PER_ATTEMPT_MS = 15_000;

/** Most time the AI stage may take, retries included. */
const AI_STAGE_BUDGET_MS = 45_000;

/** true for problems worth another go: a busy model, or a request that hung. */
function isRetryable(error: unknown): boolean {
  if (error instanceof GeminiError) return RETRYABLE_STATUSES.includes(error.status);
  // A request that never came back is worth another attempt too.
  return error instanceof Error && error.name === "AbortError";
}

/** Short label for the logs. */
function describeError(error: unknown): string {
  if (error instanceof GeminiError) return `HTTP ${error.status}`;
  if (error instanceof Error && error.name === "AbortError") return "timed out";
  return error instanceof Error ? error.message : "unknown error";
}

/** An error from the Gemini API that remembers the HTTP status. */
class GeminiError extends Error {
  status: number;

  constructor(status: number, detail: string) {
    super(`Gemini API error ${status}: ${detail.slice(0, 300)}`);
    this.name = "GeminiError";
    this.status = status;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A loose shape for whatever JSON the model hands back. */
type JsonObject = Record<string, unknown>;

/** The part of the Gemini response we read. */
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
}

/** Small helper: always return a clean, non-empty string. */
function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

/** Pull a JSON object out of a model reply, fences and chatter included. */
function parseJsonObject(text: string): JsonObject {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = (fenced ? fenced[1] : text).trim();

  // If there is any prose around the JSON, keep only the object itself.
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }

  const parsed: unknown = JSON.parse(candidate);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The reply was not a JSON object.");
  }

  return parsed as JsonObject;
}

/** Keep only well-formed issue cards. */
function coerceIssues(value: unknown): ReportIssue[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      title: asString(item.title, "Something worth fixing"),
      why: asString(item.why),
      fix: asString(item.fix),
    }))
    .filter((issue) => issue.why !== "" || issue.fix !== "")
    .slice(0, 5); // the prompt asks for 3-5, but never trust that blindly
}

/** One REST call to Gemini with one specific model. Throws on any problem. */
async function requestFromModel(
  model: string,
  prompt: string,
  temperature: number,
  apiKey: string,
  deadline: number,
): Promise<string> {
  const remaining = deadline - Date.now();
  if (remaining < 1_000) {
    throw new Error("No time left to call Gemini.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(PER_ATTEMPT_MS, remaining));

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey, // header auth keeps the key out of URLs/logs
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          // Ask for JSON directly - we still strip fences just in case.
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    // A JSON reply is tiny, so a couple of megabytes is a very safe ceiling.
    const { text: raw } = await readBodyLimited(response, 2 * 1024 * 1024);

    if (!response.ok) {
      throw new GeminiError(response.status, raw);
    }

    const data = JSON.parse(raw) as GeminiResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const output = parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();

    if (!output) {
      const blocked = data.promptFeedback?.blockReason;
      throw new Error(blocked ? `Gemini blocked the request (${blocked}).` : "Gemini returned no text.");
    }

    return output;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call Gemini, and keep trying until something works.
 *
 * The models are tried alternately (chosen, fallback, chosen, fallback). A busy
 * model is cheap to skip, but a model that hangs is expensive, so we never
 * spend two long attempts in a row on the same one. A hard deadline - and the
 * caller's own deadline - stop retries from pushing the whole page past the
 * request limit. Problems not worth retrying (a bad API key) fail at once.
 */
async function callGemini(
  prompt: string,
  temperature: number,
  deadline?: number,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const primary = geminiModel();
  const fallback = geminiFallbackModel();
  const stageDeadline = Math.min(deadline ?? Infinity, Date.now() + AI_STAGE_BUDGET_MS);

  const attempts = [primary, fallback, primary, fallback].filter(
    (model): model is string => Boolean(model),
  );

  let lastError: unknown;

  for (const model of attempts) {
    try {
      return await requestFromModel(model, prompt, temperature, apiKey, stageDeadline);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;

      console.error(`[site-check] ${model} unavailable (${describeError(error)}).`);
      if (Date.now() + 2_000 >= stageDeadline) break; // out of time, stop trying
      await delay(500);
    }
  }

  throw lastError ?? new Error("Gemini could not be reached.");
}

/* ------------------------------------------------------------------ */
/* Call 1: the written report (friendly or roast)                      */
/* ------------------------------------------------------------------ */

function friendlyPrompt(auditData: unknown): string {
  return `You are analyzing a website audit for a small business owner who is not technical.
Here is the audit data: ${JSON.stringify(auditData)}
Return ONLY valid JSON with this exact shape, no markdown and no extra text:
{ "verdict": "one sentence overall summary", "issues": [ { "title": "short plain-English issue name", "why": "why this matters for their business, no jargon", "fix": "one simple, actionable next step" } ], "closing": "one encouraging sentence about what fixing these would do for their business" }
Include the top 3 to 5 most important issues. Be helpful and non-alarming.`;
}

function roastPrompt(auditData: unknown): string {
  return `You are a funny, sarcastic friend roasting a website, but the roast must still contain genuinely useful advice. Here is the audit data: ${JSON.stringify(auditData)}
Return ONLY valid JSON with this exact shape, no markdown and no extra text:
{ "verdict": "one savage but playful sentence roasting the site overall", "issues": [ { "title": "funny but clear issue name", "why": "a playful roast of the problem that also explains why it hurts the business", "fix": "one simple, actionable next step, said with a bit of humor" } ], "closing": "a backhanded-compliment style closing line that still motivates them to fix things" }
Include the top 3 to 5 issues. Roast the website, never the person or the business owner. No offensive, hateful or personal jokes. Keep it light, witty and a little Nigerian-internet-humor friendly. Keep the real fixes accurate.`;
}

/** Calm text used when the AI reply can't be parsed. */
function fallbackReport(mode: Mode): Report {
  if (mode === "roast") {
    return {
      verdict: "The AI writer stepped out mid-roast, so you get the raw numbers instead of jokes.",
      issues: [],
      closing: "The scores above don't lie even when the writer does. Fix the weakest one first.",
      fallback: true,
    };
  }

  return {
    verdict: "We couldn't finish writing the friendly summary for this site.",
    issues: [],
    closing:
      "The scores above are real though - pick the weakest category and start there, one fix at a time.",
    fallback: true,
  };
}

export async function generateReport(
  auditData: unknown,
  mode: Mode,
  deadline?: number,
): Promise<Report> {
  try {
    const prompt = mode === "roast" ? roastPrompt(auditData) : friendlyPrompt(auditData);
    const text = await callGemini(prompt, mode === "roast" ? 0.95 : 0.6, deadline);
    const parsed = parseJsonObject(text);

    const verdict = asString(parsed.verdict);
    if (!verdict) throw new Error("The reply was missing a verdict.");

    return {
      verdict,
      issues: coerceIssues(parsed.issues),
      closing: asString(parsed.closing),
    };
  } catch (error) {
    console.error("[site-check] Report generation failed:", error);
    return fallbackReport(mode);
  }
}

/* ------------------------------------------------------------------ */
/* Call 2: Trust & Safety summary (always serious, never roasted)      */
/* ------------------------------------------------------------------ */

function trustPrompt(trustData: unknown): string {
  return `Here are the results of a website trust and safety check: ${JSON.stringify(trustData)}
Return ONLY valid JSON with this exact shape: { "summary": "2 sentence plain-English explanation of the findings", "advice": ["up to 3 short practical tips for someone deciding whether to trust this site"] }
Rules: never claim the site is a scam or fraud. Only describe the signals found. Keep the tone calm, serious and professional.`;
}

export async function generateTrustSummary(
  trustData: unknown,
  deadline?: number,
): Promise<AiTrustSummary> {
  try {
    const text = await callGemini(trustPrompt(trustData), 0.2, deadline);
    const parsed = parseJsonObject(text);

    const summary = asString(parsed.summary);
    if (!summary) throw new Error("The reply was missing a summary.");

    const adviceSource = Array.isArray(parsed.advice) ? parsed.advice : [];
    const advice = adviceSource
      .map((tip) => asString(tip))
      .filter((tip) => tip !== "")
      .slice(0, 3);

    return { summary, advice };
  } catch (error) {
    console.error("[site-check] Trust summary generation failed:", error);
    return {
      summary:
        "We couldn't generate the plain-English summary this time, but every signal we found is listed above.",
      advice: [],
      fallback: true,
    };
  }
}
