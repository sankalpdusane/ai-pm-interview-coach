<div align="center">

<img src="https://raw.githubusercontent.com/sankalpdusane/ai-pm-interview-coach/feat/v2/public/logo-placeholder.png" width="64" height="64" alt="AI PM Coach" onerror="this.style.display='none'">

# AI PM Interview Coach

**Production-grade AI coaching for product management interviews.**  
Structured evaluation · Session memory · FAANG follow-up probing · Final readiness report

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.1-F55036?style=flat-square)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

[Live Demo](https://github.com/sankalpdusane/ai-pm-interview-coach) · [V1 Tag](https://github.com/sankalpdusane/ai-pm-interview-coach/tree/v1.0) · [V2 Branch](https://github.com/sankalpdusane/ai-pm-interview-coach/tree/feat/v2) · [Open an Issue](https://github.com/sankalpdusane/ai-pm-interview-coach/issues)

</div>

---

## What This Is

A full-stack web application that evaluates product management interview answers with the rigour of a senior FAANG PM interviewer — not vague generic feedback, but structured multi-dimension scoring with **explicit anchors**, **session-aware memory**, **probing follow-up questions**, and a **final readiness classification**.

Built as a reference implementation demonstrating:
- Structured JSON extraction from LLMs in a production API pipeline
- Sliding-window rate limiting and deterministic TTL caching without external dependencies
- Mode-aware prompt engineering with scoring rubric anchors
- Type-safe full-stack TypeScript from API contract to UI component props

---

## Feature Overview

### V2 (current · `feat/v2` branch)

| Feature | Detail |
|---|---|
| **4 Interview Modes** | Product Design · Execution · Metrics · Behavioral — each with a mode-specific prompt and scoring lens |
| **4-Dimension Rubric** | Clarity · Structure · Product Thinking · Depth — scored 0–10 with explicit `10/7/4/0` waypoints per dimension |
| **Strengths / Weaknesses / Improvements** | Per-answer structured lists extracted by the model, not inferred from scores |
| **FAANG-style Follow-up** | AI generates the exact follow-up a Google/Meta/Amazon PM interviewer would ask, targeting the weakest dimension |
| **Session Memory** | Recurring weak areas and consistent strengths tracked across answers; injected into subsequent evaluation prompts |
| **Final Session Report** | Overall average, per-dimension averages, readiness classification (`ready` / `almost` / `needs_work`), and a prioritised improvement plan |
| **Response Caching** | 30-min TTL in-memory cache with namespaced keys (`v2:`) — V1 and V2 caches never collide |
| **Rate Limiting** | Sliding-window limiter: 10 req / IP / min with `Retry-After` on `429` |

### V1 (locked · `v1.0` tag · `main` branch)

30 curated questions across 5 categories · 4-dimension rubric (Structure, User Empathy, Business Acumen, Communication) · Ideal opening line · Session stats · Framework hints · Difficulty badges

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        Browser (React)                         │
│  InterviewCoach.tsx — client-only, dynamic import, no SSR      │
│  Mode selector → Question → Answer → Evaluate → Results        │
│           ↕ fetch              ↕ fetch            ↕ fetch      │
└────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────────────────────────────────────────┐
│              Next.js 15 App Router (Node.js)                   │
│                                                                │
│  POST /api/v2/evaluate   POST /api/v2/followup                 │
│  POST /api/v2/report     POST /api/evaluate  (V1, preserved)   │
│                                                                │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ rateLimit.ts │  │    cache.ts    │  │   v2-prompts.ts  │   │
│  │ Sliding-win  │  │ TTL Map cache  │  │ Mode-aware rubric │   │
│  │ 10 req/IP/m  │  │ 30-min TTL     │  │ Anchored scoring  │   │
│  └──────────────┘  └────────────────┘  └──────────────────┘   │
│                             │                                   │
└─────────────────────────────┼──────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                    Groq Inference API                          │
│          llama-3.1-8b-instant · response_format: json_object   │
│          3-attempt retry loop · non-transient error bail-out   │
└────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**Why `response_format: { type: "json_object" }` instead of streaming?**  
Evaluation results are atomic — displaying partial scores mid-render is confusing and wrong. Forcing JSON mode eliminates markdown leakage and lets us validate the full schema before any UI update. The tradeoff (latency vs. UX clarity) is correct for this domain.

**Why a sliding-window rate limiter rather than a fixed window?**  
Fixed windows leak: 10 req at 11:59 + 10 req at 12:00 = 20 requests in 2 seconds while technically "within limits." The sliding-window log stores per-IP timestamps, evicts stale entries on every check, and is accurate to the millisecond at negligible memory cost for 10 req/min per IP.

**Why a charCodeAt hash for cache keys instead of SHA-256?**  
`crypto.subtle` is async; `require('crypto')` may not be available in all Edge runtimes. The charCodeAt sum mod 1,000,000 is deterministic, runs synchronously with zero imports, and is collision-resistant for realistic PM answer lengths (40–3000 chars). Collision risk for identical inputs is zero by definition.

**Why `instrumentation.ts` for the localStorage polyfill?**  
Next.js 15's instrumentation hook runs on the server *before any route compiles or renders*. This is the only safe place to patch `globalThis.localStorage` when Node.js is started with external flags (e.g. `--localstorage-file`) that create a broken shim. Route-level polyfills run too late — webpack has already evaluated the broken value.

**Why `ssr: false` with `dynamic()` in a Client Component wrapper?**  
`InterviewCoach.tsx` uses zero localStorage at the module level — but its transitive imports (Geist font, Tailwind) may. By deferring hydration entirely to the client via `dynamic(() => import(...), { ssr: false })`, we guarantee the component never runs in Node.js context, regardless of what its dependencies do.

---

## Project Structure

```
ai-pm-coach/
├── src/
│   ├── instrumentation.ts          # Server startup hook — localStorage SSR polyfill
│   ├── app/
│   │   ├── layout.tsx              # Root layout, Geist font, SEO metadata
│   │   ├── page.tsx                # Client wrapper — dynamic import with ssr:false
│   │   ├── globals.css             # Dark design system, keyframe animations, tokens
│   │   ├── InterviewCoach.tsx      # Full V2 UI — all 6 features, 933 lines, client-only
│   │   └── api/
│   │       ├── evaluate/
│   │       │   └── route.ts        # V1 endpoint (preserved, backward-compatible)
│   │       └── v2/
│   │           ├── evaluate/
│   │           │   └── route.ts    # V2 evaluation: mode-aware, session-memory-injected
│   │           ├── followup/
│   │           │   └── route.ts    # FAANG-style follow-up question generation
│   │           └── report/
│   │               └── route.ts    # Final session report with readiness classification
│   └── lib/
│       ├── types.ts                # V1 shared types (Question, EvaluationResult, …)
│       ├── v2-types.ts             # V2 types (InterviewMode, V2EvaluationResult, …)
│       ├── questions.ts            # 30-question bank + getRandomQuestion / getQuestionsByCategory
│       ├── prompts.ts              # V1 system prompt with anchored rubric
│       ├── v2-prompts.ts           # V2 mode-aware prompts with 4-dim anchored rubric
│       ├── cache.ts                # Generic TTL Map cache, deterministic key generation
│       └── rateLimit.ts            # Sliding-window rate limiter, per-IP, 10 req/min
├── .env.example                    # Required environment variable template
├── .gitignore                      # node_modules, .next, .env.local, build artefacts
├── next.config.ts                  # Clean Next.js config (instrumentation auto-loaded)
├── package.json                    # Scripts: dev, build, start, lint
├── tsconfig.json                   # Strict TypeScript, path alias @/*
└── LICENSE                         # MIT
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 (tested on 25.x) |
| npm | ≥ 9 |
| Groq API key | Free — no credit card — [console.groq.com](https://console.groq.com/keys) |

### Installation

```bash
# 1. Clone
git clone https://github.com/sankalpdusane/ai-pm-interview-coach.git
cd ai-pm-interview-coach

# 2. Install dependencies
npm install

# 3. Environment
cp .env.example .env.local
# Open .env.local and paste your Groq API key
```

### Environment Variables

```bash
# .env.local  (never committed — see .gitignore)
GROQ_API_KEY=gsk_your_key_here
```

| Variable | Required | Source |
|---|---|---|
| `GROQ_API_KEY` | ✅ | [console.groq.com/keys](https://console.groq.com/keys) — free, no credit card |

### Run

```bash
npm run dev        # Development server → http://localhost:3000
npm run build      # Production build (webpack)
npm run start      # Serve production build
npm run lint       # ESLint
```

> **Note:** This project uses Next.js 15 with webpack (not Turbopack) to ensure stable memory usage on all machines. Turbopack can be enabled with `next dev --turbopack` if your machine has ≥ 8 GB available RAM.

---

## API Reference

All endpoints return `Content-Type: application/json`. All `POST` bodies are JSON.

### `POST /api/v2/evaluate`

Evaluates a PM answer across 4 dimensions, with optional session memory injection.

**Request**
```json
{
  "question":       "How would you improve YouTube for creators in tier-2 Indian cities?",
  "answer":         "I would start by understanding the core user segment...",
  "interview_mode": "product_design",
  "session_memory": {
    "weak_areas":           ["No metric quantification", "Generic success criteria"],
    "consistent_strengths": ["Strong user segmentation"],
    "improvements_made":    []
  }
}
```

`interview_mode` — one of: `product_design` · `execution` · `metrics` · `behavioral`  
`session_memory` — optional; omit on first answer, include from second onwards

**Success `200`**
```json
{
  "scores": {
    "clarity":          { "score": 8, "feedback": "The answer opened with a clear..." },
    "structure":        { "score": 9, "feedback": "CIRCLES framework applied..." },
    "product_thinking": { "score": 7, "feedback": "User segment well-defined but..." },
    "depth":            { "score": 6, "feedback": "Solutions named but trade-offs..." }
  },
  "overall":      7.5,
  "strengths":    ["Named the CIRCLES framework explicitly", "Specific user segment"],
  "weaknesses":   ["No quantified success metric", "Trade-offs underdeveloped"],
  "improvements": ["Add a specific metric like DAU/creator or upload frequency", "..."],
  "cached":       false
}
```

**Errors**

| Status | Condition |
|---|---|
| `400` | Missing fields, answer < 40 chars or > 3000 chars, invalid mode |
| `429` | > 10 requests per IP per minute — `Retry-After` header included |
| `500` | Groq API error or malformed model response after 3 retries |
| `503` | Groq upstream rate limit |

---

### `POST /api/v2/followup`

Generates a FAANG-style probing follow-up question targeting the weakest dimension.

**Request**
```json
{
  "question":       "How would you improve YouTube?",
  "answer":         "I would focus on creators in tier-2 cities...",
  "interview_mode": "product_design",
  "weak_areas":     ["No metric quantification"]
}
```

**Success `200`**
```json
{
  "question": "You mentioned increasing upload frequency — what specific leading indicator would you use to measure that, and how would you distinguish causation from correlation?",
  "focus":    "depth"
}
```

---

### `POST /api/v2/report`

Generates a final session report across all evaluated answers.

**Request**
```json
{
  "session_answers": [
    {
      "question":   "How would you improve YouTube?",
      "scores":     { "clarity": { "score": 8 }, "structure": { "score": 9 }, "..." },
      "overall":    7.5,
      "strengths":  ["..."],
      "weaknesses": ["..."]
    }
  ],
  "interview_mode": "product_design"
}
```

**Success `200`**
```json
{
  "overall_average":    7.2,
  "dimension_averages": { "clarity": 8, "structure": 8, "product_thinking": 7, "depth": 6 },
  "top_strengths":      ["Consistent framework usage", "Strong user empathy"],
  "key_weaknesses":     ["Metric quantification", "Trade-off depth"],
  "improvement_plan":   ["Practice adding a specific metric to every answer...", "..."],
  "readiness":          "almost",
  "recommendation":     "You are close to interview-ready. Focus one week on depth and metric precision."
}
```

`readiness` — one of: `ready` · `almost` · `needs_work`

---

### `POST /api/evaluate` (V1 — preserved)

Original 4-dimension endpoint (Structure, User Empathy, Business Acumen, Communication). Fully backward-compatible. See [V1 tag](https://github.com/sankalpdusane/ai-pm-interview-coach/tree/v1.0) for original documentation.

---

## Evaluation Rubric

Scoring uses **explicit anchors** at 10 / 7 / 4 / 0 per dimension. This forces the model to score consistently rather than gravitating to the middle. All four rubric waypoints are embedded verbatim in the system prompt.

### Clarity
| Score | Criterion |
|---|---|
| **10** | Every sentence has one job. No hedging. A non-PM could follow it cold. |
| **7** | Mostly clear with isolated hedging or one repetition |
| **4** | Requires re-reading; some sentences convey nothing |
| **0** | Incoherent or purely stream-of-consciousness |

### Structure
| Score | Criterion |
|---|---|
| **10** | Named framework (CIRCLES / STAR / RICE / JTBD / MECE), applied completely, every step explicit |
| **7** | Framework implied but not named; mostly structured |
| **4** | Some organisation; logic jumps without signposting |
| **0** | No discernible structure |

### Product Thinking
| Score | Criterion |
|---|---|
| **10** | Named user segment + specific JTBD + pain point with evidence + solution that closes the gap |
| **7** | User type identified; pain is generic ("users want it faster") |
| **4** | Users mentioned; no real insight into their motivation |
| **0** | Jumped to solution; no user mention |

### Depth
| Score | Criterion |
|---|---|
| **10** | Named metric + estimated magnitude + connected to revenue / retention model + trade-offs discussed |
| **7** | Metrics mentioned; no quantification or trade-off |
| **4** | Vague ("improve engagement") |
| **0** | No metric or trade-off at all |

---

## Question Bank

30 hand-curated questions, 6 per category, tagged by difficulty:

| Category | Count | Sample question |
|---|---|---|
| **Product Design** | 6 | *How would you improve YouTube for creators in tier-2 Indian cities?* |
| **Metrics** | 6 | *Instagram Reels engagement dropped 18% last week. Walk me through your investigation.* |
| **Strategy** | 6 | *Amazon is entering quick commerce in India. How should Zepto respond?* |
| **Estimation** | 6 | *How many UPI transactions happen in India per day?* |
| **Behavioural** | 6 | *Tell me about a time you made a product decision with incomplete data.* |

Every question includes a **one-sentence framework hint** (e.g. *"Use CIRCLES: Comprehend → Identify users → …"*) available on demand without revealing the answer.

---

## Versioning

| Version | Branch | Tag | Status |
|---|---|---|---|
| **V2** | `feat/v2` | — | Active development |
| **V1** | `main` | `v1.0` | Locked — preserved exactly as shipped |

V1 is permanently available at `git checkout v1.0`. The V2 API routes are namespaced under `/api/v2/` and use isolated cache keys (`v2:…`) so V1 and V2 never interfere.

---

## Security

- **API keys**: `GROQ_API_KEY` lives only in `.env.local`, which is explicitly gitignored via `.env*` rule. It has never appeared in any commit.
- **Rate limiting**: 10 req / IP / min server-side — no client-side trust.
- **Input validation**: Answer length enforced at both client (character counter + disabled button) and server (400 response).
- **No persistent storage**: No database, no user accounts, no PII stored. All session state is in-browser React state only.
- **Dependency surface**: 3 runtime dependencies (`next`, `groq-sdk`, `react`/`react-dom`). Zero additional runtime libraries.

---

## Contributing

```bash
# Fork → clone → branch
git checkout -b feat/your-feature

# Commit with Conventional Commits
git commit -m "feat: add feature description"
git commit -m "fix: correct behaviour description"
git commit -m "docs: update README section"

# Open a Pull Request against feat/v2
```

**Commit conventions used in this project:**
- `feat:` — new capability
- `fix:` — bug correction
- `docs:` — documentation only
- `refactor:` — code change with no behaviour change
- `chore:` — tooling, deps, config

---

## Roadmap

- [ ] Vercel deployment with environment variable guide
- [ ] Streaming evaluation results (SSE) for perceived performance
- [ ] Spaced-repetition question scheduler based on weak dimensions
- [ ] Export session report as PDF
- [ ] Multi-language support (Hindi, German, French)

---

## License

[MIT](LICENSE) © 2026 Sankalp Dusane

---

<div align="center">

Built with precision using [Groq](https://groq.com) · [Next.js](https://nextjs.org) · [Tailwind CSS](https://tailwindcss.com) · [TypeScript](https://www.typescriptlang.org)

</div>
