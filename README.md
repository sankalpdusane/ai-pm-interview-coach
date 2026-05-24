<div align="center">

# 🎯 AI PM Interview Coach

**Structured, AI-powered feedback on your product management interview answers.**  
Built with Next.js 15 · Groq · Llama 3.1 · TypeScript · Tailwind CSS

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.1-F55036?logo=groq)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Overview

AI PM Coach evaluates product management interview answers the way a senior PM would — not generically, but against a **rubric with explicit waypoints** across four dimensions. Answers are scored 0–10 per dimension using Llama 3.1 8B running on Groq's inference API, with structured JSON output that drives a real-time results UI.

The project is designed as a reference implementation for:

- **Streaming-free, structured LLM output** via `response_format: { type: "json_object" }`
- **Production API patterns** — rate limiting, TTL cache, retry loop with non-transient error bail-out
- **Type-safe full-stack TypeScript** with shared types used across API routes and UI components

---

## Features

| Feature | Detail |
|---|---|
| **30 curated questions** | 6 per category: Product Design · Metrics · Strategy · Estimation · Behavioural |
| **4-dimension rubric** | Structure · User Empathy · Business Acumen · Communication, each scored 0–10 |
| **Anchored scoring** | Rubric includes 10 / 7 / 4 / 0 waypoints — no vague middle-scoring |
| **Ideal opening** | Model writes the actual first sentence a top-10% candidate would use |
| **Sliding-window rate limiter** | 10 req / IP / min, `Retry-After` header on 429 |
| **TTL cache** | 30-min in-memory cache keyed by deterministic question+answer hash |
| **Session stats** | Tracks count, average score, and best score across the session |
| **Framework hints** | Every question includes a one-sentence framework hint (CIRCLES, STAR, RICE, etc.) |
| **Difficulty badges** | Junior · Mid · Senior labels on every question |
| **Cache indicator** | UI shows whether a result is fresh or served from cache |

---

## Tech Stack

```
Frontend    Next.js 16 (App Router)  +  React 19  +  Tailwind CSS 4
Backend     Next.js API Route (Edge-compatible)
AI          Groq SDK  →  llama-3.1-8b-instant
Language    TypeScript 5  (strict mode)
```

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout + SEO metadata
│   ├── page.tsx                # Main UI — two-panel, fully responsive
│   └── api/
│       └── evaluate/
│           └── route.ts        # POST handler: validate → rate-limit → cache → Groq → cache → return
└── lib/
    ├── types.ts                # Shared TypeScript types (EvaluationResult, Question, etc.)
    ├── questions.ts            # 30-question bank + getRandomQuestion / getQuestionsByCategory
    ├── prompts.ts              # LLM system prompt with anchored rubric + strict JSON contract
    ├── cache.ts                # Generic TTL Map cache with deterministic key generation
    ├── rateLimit.ts            # Sliding-window rate limiter (10 req / IP / min)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A free [Groq API key](https://console.groq.com) (no credit card required)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/ai-pm-coach.git
cd ai-pm-coach

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and add your Groq API key

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Your Groq API key from [console.groq.com](https://console.groq.com/keys) |

> **Security note:** `.env.local` is gitignored and will never be committed. Use `.env.example` as the public template.

---

## API Reference

### `POST /api/evaluate`

Evaluates a PM interview answer and returns structured scores.

**Request body**

```json
{
  "question": "How would you improve Swiggy?",
  "answer": "I would first clarify the goal...",
  "category": "product_design"
}
```

**`category`** — one of: `product_design` · `metrics` · `strategy` · `estimation` · `behavioural`

**Success response** `200`

```json
{
  "scores": {
    "structure":        { "score": 8, "feedback": "..." },
    "user_empathy":     { "score": 9, "feedback": "..." },
    "business_acumen":  { "score": 9, "feedback": "..." },
    "communication":    { "score": 8, "feedback": "..." }
  },
  "overall": 8.5,
  "top_strength": "...",
  "top_fix": "...",
  "ideal_opening": "...",
  "evaluated_at": "2026-05-17T15:05:02.119Z",
  "model_used": "llama-3.1-8b-instant",
  "cached": false
}
```

**Error responses**

| Status | Condition |
|---|---|
| `400` | Answer < 40 chars, > 3000 chars, or missing fields |
| `429` | > 10 requests per IP per minute |
| `500` | Groq API error or unexpected model response shape |
| `503` | Groq upstream rate limit hit |

---

## Evaluation Rubric

The system prompt embeds explicit scoring anchors for each dimension so the model scores consistently rather than defaulting to the middle.

### Structure
| Score | Criteria |
|---|---|
| 10 | Named framework (CIRCLES / STAR / RICE / JTBD), applied consistently, every step explicit |
| 7 | Framework implied but not named, mostly structured |
| 4 | Some organisation, logic jumps around |
| 0 | Pure stream of consciousness |

### User Empathy
| Score | Criteria |
|---|---|
| 10 | Specific segment + specific JTBD + specific pain with evidence |
| 7 | User type identified, pain is generic ("users want it faster") |
| 4 | Mentioned users, no real insight |
| 0 | Jumped straight to solution, no user mention |

### Business Acumen
| Score | Criteria |
|---|---|
| 10 | Named metric + estimated impact + connected to revenue/retention model |
| 7 | Metrics mentioned, no quantification |
| 4 | Vague "improve engagement" |
| 0 | No metric mentioned |

### Communication
| Score | Criteria |
|---|---|
| 10 | Every sentence earned its place — presentable to a CEO in 2 minutes |
| 7 | Mostly clear with some hedging or repetition |
| 4 | Hard to follow, too long or too short |
| 0 | Incoherent |

---

## Architecture Decisions

### Why `response_format: { type: "json_object" }` instead of streaming?

Evaluation results are atomic — showing partial scores would confuse rather than help. Forcing JSON mode eliminates markdown leakage and lets us validate the full response shape before displaying anything.

### Why a sliding-window rate limiter instead of a fixed window?

Fixed windows allow up to 2× the limit at window boundaries (e.g. 10 requests at 11:59 + 10 at 12:00). The sliding-window log stores per-IP timestamps and evicts stale entries on every check — accurate at negligible memory cost for 10 req/min per IP.

### Why a charCodeAt hash for cache keys instead of SHA-256?

SHA-256 requires the Node.js `crypto` module or a polyfill in Edge runtimes. The charCodeAt sum mod 1,000,000 is deterministic, collision-resistant for PM answer lengths (~100–500 words), and runs synchronously with no imports.

---

## Scripts

```bash
npm run dev      # Start development server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`
4. Push and open a Pull Request

---

## License

MIT © 2026. See [LICENSE](LICENSE) for details.

---

<div align="center">
Built with ❤️ using <a href="https://groq.com">Groq</a> · <a href="https://nextjs.org">Next.js</a> · <a href="https://tailwindcss.com">Tailwind CSS</a>
</div>
