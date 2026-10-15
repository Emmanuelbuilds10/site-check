/**
 * Trust signals check.
 *
 * We read the homepage HTML and look for the things real businesses usually
 * bother to publish: a way to contact them, a privacy policy, and so on.
 * These are WEAK signals. An honest one-person business can easily be missing
 * several of them, so we never treat a miss as evidence of fraud.
 */

import type { TrustCheck } from "@/lib/types";

export const TRUST_SIGNALS_CHECK_NAME = "Contact and policy pages";

interface Signal {
  label: string;
  found: boolean;
}

/** Remove script and style blocks so their code can't create false matches. */
function readableHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

export function buildTrustSignalsCheck(html: string): TrustCheck {
  const name = TRUST_SIGNALS_CHECK_NAME;
  const text = readableHtml(html);

  const signals: Signal[] = [
    {
      label: "contact page",
      found: /href=["'][^"']*contact/i.test(html) || /\bcontact us\b/i.test(text),
    },
    {
      label: "phone number",
      found: /href=["']tel:/i.test(html) || /(\+?\d[\d\s().-]{7,}\d)/.test(text),
    },
    {
      label: "email address",
      found:
        /href=["']mailto:/i.test(html) ||
        /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text),
    },
    {
      label: "physical address",
      found:
        /<address[\s>]/i.test(html) ||
        /"streetAddress"/i.test(html) ||
        /\b\d{1,5}\s+[A-Za-z][A-Za-z.'-]*\s+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|way|close|crescent|plaza|suite|floor)\b/i.test(
          text,
        ),
    },
    {
      label: "privacy policy",
      found: /privacy/i.test(html),
    },
    {
      label: "terms of service",
      found:
        /href=["'][^"']*terms/i.test(html) ||
        /terms (of service|and conditions|& conditions)/i.test(text),
    },
    {
      label: "refund or returns policy",
      found:
        /refund|returns? policy|money[- ]back|shipping policy|delivery policy/i.test(text),
    },
  ];

  const found = signals.filter((signal) => signal.found);
  const missing = signals.filter((signal) => !signal.found);

  const missingList = missing.map((signal) => signal.label).join(", ");

  if (found.length === 0) {
    return {
      name,
      status: "caution",
      detail:
        "We couldn't find any of the usual contact or policy information on the homepage. These are weak signals - many real sites keep them on a subpage - but it is worth asking where they are.",
    };
  }

  if (missing.length >= 3) {
    return {
      name,
      status: "caution",
      detail: `Found ${found.length} of 7 things we look for. Missing: ${missingList}. These are weak signals only, not proof of anything.`,
    };
  }

  if (missing.length === 0) {
    return {
      name,
      status: "ok",
      detail: "The homepage shows all 7 of the contact and policy signals we look for.",
    };
  }

  return {
    name,
    status: "ok",
    detail: `Found ${found.length} of 7 signals. Still missing: ${missingList}. That's normal for many sites.`,
  };
}
