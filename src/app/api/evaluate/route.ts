import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

import type { EvaluationResult, EvaluationDimension, QuestionCategory } from "@/lib/types";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCached, setCached, generateCacheKey, EVALUATION_TTL_MS } from "@/lib/cache";
import { EVALUATOR_SYSTEM_PROMPT } from "@/lib/prompts";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "llama-3.1-8b-instant";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;

const REQUIRED_DIMENSIONS: EvaluationDimension[] = [
  "structure",
  "user_empathy",
  "business_acumen",
  "communication",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Sleep for `ms` milliseconds — used between retry attempts. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate the raw JSON object returned by the model.
 * Returns true only if all four dimension scores, plus the three top-level
 * string fields, are present and correctly typed.
 */
function isValidModelResponse(raw: unknown): raw is Omit<EvaluationResult, "evaluated_at" | "model_used" | "cached"> {
  if (!raw || typeof raw !== "object") return false;

  const obj = raw as Record<string, unknown>;

  // Top-level string fields
  if (
    typeof obj.overall !== "number" ||
    typeof obj.top_strength !== "string" ||
    typeof obj.top_fix !== "string" ||
    typeof obj.ideal_opening !== "string"
  ) {
    return false;
  }

  // scores object
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

/**
 * Build the user-turn message that contains the actual question + answer.
 * Keeping this separate from the system prompt means the same system prompt
 * can be reused for any question without modification.
 */
function buildUserMessage(question: string, answer: string): string {
  return `QUESTION:\n${question}\n\nCANDIDATE ANSWER:\n${answer}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step A: Parse and validate request body ──────────────────────────────

  let question: string;
  let answer: string;
  let category: QuestionCategory;

  try {
    const body = await request.json();
    question = body.question;
    answer = body.answer;
    category = body.category;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!question || !answer || !category) {
    return NextResponse.json(
      { error: "Missing required fields: question, answer, category." },
      { status: 400 }
    );
  }

  if (answer.trim().length < 40) {
    return NextResponse.json(
      {
        error:
          "Answer too short. Write at least 2-3 sentences to get meaningful feedback.",
      },
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

  // x-forwarded-for may be a comma-separated list; take only the first entry.
  const ip = rawIp.split(",")[0].trim();

  const rateResult = checkRateLimit(ip);

  if (!rateResult.allowed) {
    const retryAfter = rateResult.retryAfter ?? RETRY_DELAY_MS;
    return NextResponse.json(
      {
        error: "Too many requests. Please wait 60 seconds.",
        retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfter / 1_000)) },
      }
    );
  }

  // ── Step C: Cache check ───────────────────────────────────────────────────

  const cacheKey = generateCacheKey(question, answer);
  const cached = getCached<EvaluationResult>(cacheKey);

  if (cached) {
    return NextResponse.json({ ...cached, cached: true }, { status: 200 });
  }

  // ── Step D: Groq API call with retry ─────────────────────────────────────

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  let rawResponse: unknown = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(question, answer) },
        ],
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        rawResponse = JSON.parse(content);
        break; // Success — exit the retry loop.
      }
    } catch (err) {
      lastError = err;

      // Don't retry on non-transient errors (auth failure, bad request).
      if (
        typeof err === "object" &&
        err !== null &&
        "status" in err
      ) {
        const status = (err as { status: number }).status;
        if (status === 429) {
          return NextResponse.json(
            { error: "AI service busy. Please try again in 30 seconds." },
            { status: 503 }
          );
        }
        if (status === 401) {
          console.error("[evaluate] Invalid Groq API key — check GROQ_API_KEY in .env.local");
          return NextResponse.json(
            { error: "AI service configuration error. Please try again later." },
            { status: 500 }
          );
        }
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  // All attempts exhausted with no response.
  if (!rawResponse) {
    console.error("[evaluate] Groq call failed after retries:", lastError);
    return NextResponse.json(
      { error: "Failed to reach AI service. Please try again." },
      { status: 500 }
    );
  }

  // ── Step E: Parse and validate model response ─────────────────────────────

  if (!isValidModelResponse(rawResponse)) {
    console.error("[evaluate] Unexpected model response shape:", rawResponse);
    return NextResponse.json(
      { error: "Model returned unexpected format. Please try again." },
      { status: 500 }
    );
  }

  const result: EvaluationResult = {
    scores: rawResponse.scores,
    overall: rawResponse.overall,
    top_strength: rawResponse.top_strength,
    top_fix: rawResponse.top_fix,
    ideal_opening: rawResponse.ideal_opening,
    evaluated_at: new Date().toISOString(),
    model_used: MODEL,
    cached: false,
  };

  // ── Step F: Cache and return ──────────────────────────────────────────────

  setCached<EvaluationResult>(cacheKey, result, EVALUATION_TTL_MS);

  return NextResponse.json(result, { status: 200 });
}
