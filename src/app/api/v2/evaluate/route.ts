/**
 * POST /api/v2/evaluate
 *
 * V2 enhanced evaluation route.
 *
 * Changes vs V1:
 *  - Accepts `interview_mode` instead of `category`
 *  - Accepts optional `session_memory` for progressive context
 *  - Returns V2 schema: 4 new dimensions + strengths/weaknesses/improvements arrays
 *  - Cache key is namespaced with "v2:" prefix to avoid V1 collisions
 *
 * Unchanged from V1:
 *  - Rate limiter (same Map, same sliding window)
 *  - Cache (same TTL Map, same generateCacheKey + prefix)
 *  - Retry loop (3 attempts, 1s delay, bail on 401/429)
 *  - Response validation before caching
 */

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

import type {
  V2EvaluationResult,
  V2EvaluationDimension,
  InterviewMode,
  SessionMemory,
} from "@/lib/v2-types";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCached, setCached, generateCacheKey, EVALUATION_TTL_MS } from "@/lib/cache";
import { buildV2EvaluatorPrompt } from "@/lib/v2-prompts";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "llama-3.1-8b-instant";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;

const VALID_MODES: InterviewMode[] = [
  "product_design",
  "execution",
  "metrics",
  "behavioral",
];

const REQUIRED_DIMENSIONS: V2EvaluationDimension[] = [
  "clarity",
  "structure",
  "product_thinking",
  "depth",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Validate the raw JSON object returned by the V2 model. */
function isValidV2Response(
  raw: unknown
): raw is Omit<V2EvaluationResult, "interview_mode" | "evaluated_at" | "model_used" | "cached"> {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.overall !== "number") return false;
  if (!Array.isArray(obj.strengths) || obj.strengths.length < 1) return false;
  if (!Array.isArray(obj.weaknesses) || obj.weaknesses.length < 1) return false;
  if (!Array.isArray(obj.improvements) || obj.improvements.length < 1) return false;
  if (!obj.scores || typeof obj.scores !== "object") return false;

  const scores = obj.scores as Record<string, unknown>;
  for (const dim of REQUIRED_DIMENSIONS) {
    const entry = scores[dim];
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as Record<string, unknown>).score !== "number" ||
      typeof (entry as Record<string, unknown>).feedback !== "string"
    ) {
      return false;
    }
  }

  return true;
}

function buildUserMessage(question: string, answer: string): string {
  return `QUESTION:\n${question}\n\nCANDIDATE ANSWER:\n${answer}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step A: Parse and validate ───────────────────────────────────────────

  let question: string;
  let answer: string;
  let interview_mode: InterviewMode;
  let session_memory: SessionMemory | undefined;

  try {
    const body = await request.json();
    question = body.question;
    answer = body.answer;
    interview_mode = body.interview_mode;
    session_memory = body.session_memory;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!question || !answer || !interview_mode) {
    return NextResponse.json(
      { error: "Missing required fields: question, answer, interview_mode." },
      { status: 400 }
    );
  }

  if (!VALID_MODES.includes(interview_mode)) {
    return NextResponse.json(
      { error: `Invalid interview_mode. Must be one of: ${VALID_MODES.join(", ")}.` },
      { status: 400 }
    );
  }

  if (answer.trim().length < 40) {
    return NextResponse.json(
      { error: "Answer too short. Write at least 2–3 sentences to get meaningful feedback." },
      { status: 400 }
    );
  }

  if (answer.length > 3000) {
    return NextResponse.json(
      { error: "Answer too long. Keep it under 3000 characters." },
      { status: 400 }
    );
  }

  // ── Step B: Rate limiting ─────────────────────────────────────────────────

  const rawIp =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1";
  const ip = rawIp.split(",")[0].trim();

  const rateResult = checkRateLimit(ip);
  if (!rateResult.allowed) {
    const retryAfter = rateResult.retryAfter ?? RETRY_DELAY_MS;
    return NextResponse.json(
      { error: "Too many requests. Please wait 60 seconds.", retryAfter },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfter / 1_000)) },
      }
    );
  }

  // ── Step C: Cache check (V2 namespace prefix) ─────────────────────────────

  // Include mode in cache key so the same Q&A in different modes gets its own result.
  const rawKey = generateCacheKey(`${interview_mode}:${question}`, answer);
  const cacheKey = `v2:${rawKey}`;
  const cached = getCached<V2EvaluationResult>(cacheKey);

  if (cached) {
    return NextResponse.json({ ...cached, cached: true }, { status: 200 });
  }

  // ── Step D: Groq API call with retry ─────────────────────────────────────

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const systemPrompt = buildV2EvaluatorPrompt(interview_mode, session_memory);

  let rawResponse: unknown = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(question, answer) },
        ],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        rawResponse = JSON.parse(content);
        break;
      }
    } catch (err) {
      lastError = err;

      if (typeof err === "object" && err !== null && "status" in err) {
        const status = (err as { status: number }).status;
        if (status === 429) {
          return NextResponse.json(
            { error: "AI service busy. Please try again in 30 seconds." },
            { status: 503 }
          );
        }
        if (status === 401) {
          console.error("[v2/evaluate] Invalid Groq API key.");
          return NextResponse.json(
            { error: "AI service configuration error. Please try again later." },
            { status: 500 }
          );
        }
      }

      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  if (!rawResponse) {
    console.error("[v2/evaluate] Groq call failed after retries:", lastError);
    return NextResponse.json(
      { error: "Failed to reach AI service. Please try again." },
      { status: 500 }
    );
  }

  // ── Step E: Validate model response ──────────────────────────────────────

  if (!isValidV2Response(rawResponse)) {
    console.error("[v2/evaluate] Unexpected model response shape:", rawResponse);
    return NextResponse.json(
      { error: "Model returned unexpected format. Please try again." },
      { status: 500 }
    );
  }

  // ── Step F: Build result, cache, and return ───────────────────────────────

  const result: V2EvaluationResult = {
    scores: rawResponse.scores,
    overall: rawResponse.overall,
    strengths: rawResponse.strengths,
    weaknesses: rawResponse.weaknesses,
    improvements: rawResponse.improvements,
    interview_mode,
    evaluated_at: new Date().toISOString(),
    model_used: MODEL,
    cached: false,
  };

  setCached<V2EvaluationResult>(cacheKey, result, EVALUATION_TTL_MS);

  return NextResponse.json(result, { status: 200 });
}
