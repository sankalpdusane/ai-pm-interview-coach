/**
 * POST /api/v2/followup
 *
 * Generates a sharp, context-aware follow-up question based on the
 * candidate's previous answer. Behaves like a real FAANG interviewer
 * probing trade-offs, metrics, edge cases, or depth.
 *
 * Rate limited (shared rate limiter with V1 + V2 evaluate).
 * Cached for 30 minutes — identical Q&A in same mode = same follow-up.
 */

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

import type { FollowUpResult, InterviewMode } from "@/lib/v2-types";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCached, setCached, generateCacheKey, EVALUATION_TTL_MS } from "@/lib/cache";
import { buildFollowUpPrompt } from "@/lib/v2-prompts";

const MODEL = "llama-3.1-8b-instant";
const VALID_MODES: InterviewMode[] = ["product_design", "execution", "metrics", "behavioral"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidFollowUp(raw: unknown): raw is { question: string; focus: string } {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  return typeof obj.question === "string" && typeof obj.focus === "string";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse & validate ─────────────────────────────────────────────────────

  let question: string;
  let answer: string;
  let interview_mode: InterviewMode;
  let weak_areas: string[] | undefined;

  try {
    const body = await request.json();
    question = body.question;
    answer = body.answer;
    interview_mode = body.interview_mode;
    weak_areas = body.weak_areas;
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

  // ── Rate limiting ─────────────────────────────────────────────────────────

  const rawIp =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1";
  const ip = rawIp.split(",")[0].trim();
  const rateResult = checkRateLimit(ip);

  if (!rateResult.allowed) {
    const retryAfter = rateResult.retryAfter ?? 1000;
    return NextResponse.json(
      { error: "Too many requests. Please wait 60 seconds.", retryAfter },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfter / 1_000)) } }
    );
  }

  // ── Cache check ───────────────────────────────────────────────────────────

  const rawKey = generateCacheKey(`followup:${interview_mode}:${question}`, answer);
  const cacheKey = `v2:followup:${rawKey}`;
  const cached = getCached<FollowUpResult>(cacheKey);
  if (cached) return NextResponse.json(cached, { status: 200 });

  // ── Groq call ─────────────────────────────────────────────────────────────

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const weakContext =
    weak_areas && weak_areas.length > 0
      ? `\n\nNote: This candidate has shown recurring weaknesses in: ${weak_areas.join(", ")}. Probe these areas if the answer gives an opening to do so.`
      : "";

  let rawResponse: unknown = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: buildFollowUpPrompt(interview_mode) },
          {
            role: "user",
            content: `ORIGINAL QUESTION:\n${question}\n\nCANDIDATE ANSWER:\n${answer}${weakContext}`,
          },
        ],
        temperature: 0.4, // Slightly higher — want varied, non-formulaic follow-ups
        max_tokens: 200,
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
        const s = (err as { status: number }).status;
        if (s === 429) return NextResponse.json({ error: "AI service busy. Try again in 30s." }, { status: 503 });
        if (s === 401) return NextResponse.json({ error: "AI service configuration error." }, { status: 500 });
      }
      if (attempt < 3) await sleep(1000);
    }
  }

  if (!rawResponse || !isValidFollowUp(rawResponse)) {
    console.error("[v2/followup] Failed or invalid response:", lastError ?? rawResponse);
    return NextResponse.json({ error: "Failed to generate follow-up question. Please try again." }, { status: 500 });
  }

  const result: FollowUpResult = {
    question: (rawResponse as { question: string }).question,
    focus: (rawResponse as { focus: string }).focus,
    generated_at: new Date().toISOString(),
  };

  setCached<FollowUpResult>(cacheKey, result, EVALUATION_TTL_MS);
  return NextResponse.json(result, { status: 200 });
}
