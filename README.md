# Site Check

Paste any website address and get two things back:

1. **A fun, readable report** - an animated grade plus a written summary in either
   **Friendly** or **Roast my site** mode.
2. **A Trust & Safety check** - a serious, jargon-free list of the warning signs
   worth knowing about before you trust a site.

Built with **Next.js (App Router) + Tailwind CSS**. No database, no accounts, no
payments, and it fits comfortably inside Vercel's free tier.

---

## What it checks

| Check | What it does | Where it comes from |
| --- | --- | --- |
| PageSpeed Insights | Performance, SEO, Accessibility and Best Practices scores (mobile) | Google PageSpeed Insights API |
| Safe Browsing | Is this exact URL on a Google threat list? | Google Safe Browsing API |
| Domain age | How long the domain has existed, via RDAP | `rdap.org` (public, no key) |
| HTTPS & SSL | Does the site use HTTPS with a valid, unexpired certificate? | Direct TLS connection |
| Redirects | Where visitors actually end up | Direct request |
| Security headers | HSTS, `X-Content-Type-Options`, `X-Frame-Options` | Response headers |
| Trust signals | Contact page, phone, email, address, privacy, terms, refunds | Homepage HTML |

**Scoring:** the overall score is the average of the four PageSpeed category
scores, rounded. Grades are A (90+), B (80+), C (70+), D (60+) and F below that.
Every score and trust level is calculated in plain code (`lib/scoring.ts`) - the
AI only writes the words, so results stay consistent.

---

## 1. Get your API keys

You need three keys. Two come from Google Cloud, one from Google AI Studio.

### a) PageSpeed Insights + Safe Browsing (Google Cloud Console)

1. Go to <https://console.cloud.google.com/> and sign in.
2. Create a project (top bar -> project picker -> **New project**). Any name works.
3. Enable the two APIs. In the left menu go to **APIs & Services -> Library** and
   enable:
   - **PageSpeed Insights API**
   - **Safe Browsing API**
4. Go to **APIs & Services -> Credentials -> Create credentials -> API key**.
   Copy the key.
5. Optional but recommended: click **Restrict key** -> under *API restrictions*
   choose only "PageSpeed Insights API" and "Safe Browsing API".

You can reuse one key for both services, or create two keys and restrict each
one to a single API. Either way works - just make sure the key you paste for
each variable has the matching API enabled.

### b) Gemini (Google AI Studio)

1. Go to <https://aistudio.google.com/app/apikey> and sign in.
2. Click **Create API key** and copy it.

Gemini model names change often. The default here is a current Flash model, but
you can point `GEMINI_MODEL` at any Flash model. The live list is at
<https://ai.google.dev/gemini-api/docs/models>.

There is also an optional `GEMINI_FALLBACK_MODEL` (default
`gemini-3.5-flash-lite`). Google's newest Flash models sometimes reply *"this
model is currently experiencing high demand"* (HTTP 503), and a free-tier key
can run out of quota for one model (HTTP 429) while another still works. When
that happens the app tries the fallback model instead of giving up and showing
the fallback text. Set it to `none` to disable that.

---

## 2. Run it locally

```bash
# 1. install dependencies
npm install

# 2. create your env file from the example
cp .env.example .env.local     # on Windows: copy .env.example .env.local

# 3. open .env.local and paste your three keys in

# 4. start the dev server
npm run dev
```

Then open <http://localhost:3000>.

Useful scripts:

```bash
npm run dev     # development server
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

---

## 3. Deploy to Vercel (free tier)

1. Push this project to a GitHub repository.
2. Go to <https://vercel.com/new> and import that repository.
3. Vercel will detect Next.js and use the right build settings automatically.
4. Before clicking Deploy, open **Environment Variables** and add all four:

   | Name | Value |
   | --- | --- |
   | `PAGESPEED_API_KEY` | your key |
   | `SAFE_BROWSING_API_KEY` | your key |
   | `GEMINI_API_KEY` | your key |
   | `GEMINI_MODEL` | `gemini-3.8-flash` (or another Flash model) |

   Optionally add `GEMINI_FALLBACK_MODEL` too (`gemini-3.5-flash-lite`) so a
   busy or quota-limited model doesn't cost you a report.

5. Click **Deploy**.

If you already deployed without the variables, add them under
**Project -> Settings -> Environment Variables** and redeploy.

> **Note on timing:** a full analysis runs a PageSpeed test (10-30 seconds) plus
> the other checks in parallel, so it can take up to about a minute. The route is
> configured with `maxDuration = 60`, which is the maximum on Vercel's free Hobby
> plan. If you move to Pro you can raise it, or use `strategy=desktop` and fewer
> categories to make it faster.

---

## Design notes

The look is deliberate, not a template:

- **Warm paper, not white.** Off-white `#f2eee6` with a faint dot field and a
  film-grain overlay, so the page has depth instead of flat grey.
- **Three typefaces with separate jobs.** Space Grotesk speaks, JetBrains Mono
  handles labels and numbers, Instrument Serif appears only for the verdict and
  the closing line.
- **One committed accent per mode.** Deep green for Friendly, burnt orange for
  Roast. It is handed down as a CSS variable, so every accent surface - buttons,
  the dial, the bars, the underlines - changes together.
- **Grade colours are fixed by meaning** (A green, B lime, C yellow, D orange,
  F red) and never follow the mode, because the meaning must not change with the
  tone.
- **Motion is springy and small.** Text rises word by word, cards reveal as they
  scroll in, the grade dial counts up, the toggle thumb slides, the button leans
  towards the pointer, and a soft glow plus a trailing ring follow the cursor.
  Everything animates on transform and opacity (the score bars grow their width,
  the only exception), and all of it is switched off for visitors who ask for
  reduced motion.

## How it works

```
app/
  page.tsx                  the whole UI: form, loading, results, reset
  layout.tsx                fonts + page metadata
  globals.css               Tailwind theme, keyframes, base styles
  api/analyze/route.ts      POST endpoint (server only - keeps keys hidden)
components/
  AnalyzeForm.tsx           URL field + mode switch + "Analyze"/"Roast it"
  ModeToggle.tsx            Friendly / Roast my site, with a sliding thumb
  LoadingIndicator.tsx      scan panel + message that swaps every 2.5s
  GradeCard.tsx             animated count-up, dial, grade and category bars
  ReportSection.tsx         verdict quote, issue cards, closing line
  TrustSection.tsx          level badge, checklist, AI summary, disclaimer
  CursorGlow.tsx            the pointer glow and trailing ring
  MagneticButton.tsx        button that leans towards the pointer
  TiltCard.tsx              shallow 3D tilt, follows the pointer
  Reveal.tsx                reveals children as they scroll into view
  Marquee.tsx               the infinite ticker strips
  SplitText.tsx             word-by-word heading reveal
lib/
  types.ts                  shared types for the API response
  url.ts                    URL validation + the SSRF guard + safe fetching
  rateLimit.ts              best-effort per-visitor rate limiting
  analyze.ts                runs every check, then assembles the response
  scoring.ts                all scores and grades (never the AI)
  gemini.ts                 the two Gemini calls, JSON parsing and fallbacks
  checks/                   one small file per check
```

**Request flow:** the browser POSTs `{ url, mode }` to `/api/analyze`. The route
normalizes and validates the URL, refuses private/internal hosts, then runs all
the network checks in parallel with `Promise.allSettled` so one failure never
breaks the rest. After that it makes **two Gemini calls in parallel** - one for
the report (in the chosen mode) and one for the trust summary (always serious) -
and returns everything as a single JSON object. If any single part fails, the
rest still comes back and the failed part is reported as "Could not check".

### Safety notes

- **SSRF protection** (`lib/url.ts`): the server blocks `localhost`, `.local`
  names, private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x,
  100.64-127.x and more), non-HTTP protocols, and it re-checks **every redirect
  hop** before following it. Every outbound request has a timeout and a 512 KB
  body limit.
- **Keys stay server-side.** They are read from `process.env` inside route
  handlers only, and the Gemini key is sent in an `x-goog-api-key` header so it
  never appears in a URL.
- **The endpoint protects itself.** Before any work happens a request must pass
  a per-visitor rate limit (15 analyses per 10 minutes - best-effort: the
  counters live in the memory of one server instance, so a strict guarantee
  would need a shared store such as Redis or a KV), send
  `content-type: application/json`, and stay under 2 KB. Replies carry
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Strict-Transport-Security`, `Permissions-Policy` and
  `Cross-Origin-Opener-Policy`, and the framework stops advertising itself.
  Only `POST` is accepted; other methods get a 405.
- **The writer never sees raw page HTML.** Only derived signals - Google's
  audit titles and descriptions, our own check results, and the scores - are
  sent to the model, and the payload says outright when the speed test did not
  run, so the report cannot invent performance problems.
- **Warning signs only.** The Trust & Safety section never states or implies
  that a site is a scam or fraudulent. It describes the signals it found, and the
  disclaimer is always visible under the checklist.
- **Weak signals are labelled as weak.** Missing contact details or a young
  domain are hints, not proof. Many perfectly honest small sites trip them.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Could not check" on every trust row | Missing or invalid `SAFE_BROWSING_API_KEY` / APIs not enabled in Google Cloud |
| The grade says "Could not score" | PageSpeed Insights timed out, or the key is missing / not enabled for that API |
| The report shows the fallback text | Gemini key missing, model name wrong, or the model returned something we couldn't parse. Check the server logs - the real reason is logged there |
| Log says the model "is busy (503)" | Google's newest Flash model is overloaded right now. The app retries and then uses `GEMINI_FALLBACK_MODEL`, so a report should still appear |
| "That's a lot of checks in a row" | The rate limit kicked in. Wait ten minutes, or raise `MAX_REQUESTS` in `lib/rateLimit.ts` |
| "That request was too large" | The body broke the 2 KB cap in `app/api/analyze/route.ts`. A real request is about 60 bytes |
| The cursor effects don't appear | They're intentionally off on touch screens and for `prefers-reduced-motion` |
| `npm run build` fails on an env var | That's expected if a check reads a key at build time; run the app, not the build, to test keys |

---

## License

MIT - do whatever you like with it.
