/**
 * POST /api/v2/report
 *
 * Generates the final end-of-session report after 2+ evaluations.
 * Synthesises all session Q&As into a structured report with:
 *  - Dimension averages
 *  - Top strengths + key weaknesses
 *  - Numbered improvement plan
 *  - Readiness classification (ready / almost / needs_work)
 *  - One candid recommendation sentence
 *
 * NOT cached — reports are session-specific and should always be fresh.
 * Rate limited via the shared rate limiter.
 */

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

import type {
  FinalReport,
  V2EvaluationDimension,
  V2ReportRequest,
  ReadinessLevel,
} from "@/lib/v2-types";
import { checkRateLimit } from "@/lib/rateLimit";
import { FINAL_REPORT_SYSTEM_PROMPT } from "@/lib/v2-prompts";

const MODEL = "llama-3.1-8b-instant";
const REQUIRED_DIMS: V2EvaluationDimension[] = ["clarity", "structure", "product_thinking", "depth"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidReport(raw: unknown): raw is {
  top_strengths: string[];
  key_weaknesses: string[];
  improvement_plan: string[];
  readiness: ReadinessLevel;
  recommendation: string;
} {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  return (
    Array.isArray(obj.top_strengths) &&
    Array.isArray(obj.key_weaknesses) &&
    Array.isArray(obj.improvement_plan) &&
    typeof obj.readiness === "string" &&
    typeof obj.recommendation === "string"
  );
}

/** Build dimension averages from session answers server-side (not trusted from client). */
function computeDimensionAverages(
  session_answers: V2ReportRequest["session_answers"]
): Record<V2EvaluationDimension, number> {
  const totals: Record<string, number> = {};
  for (const dim of REQUIRED_DIMS) totals[dim] = 0;

  for (const sa of session_answers) {
    for (const dim of REQUIRED_DIMS) {
      totals[dim] += sa.scores[dim]?.score ?? 0;
    }
  }

  const averages = {} as Record<V2EvaluationDimension, number>;
  const n = session_answers.length;
  for (const dim of REQUIRED_DIMS) {
    averages[dim] = Math.round((totals[dim] / n) * 10) / 10;
  }
  return averages;
}

function computeOverallAverage(session_answers: V2ReportRequest["session_answers"]): number {
  const total = session_answers.reduce((sum, sa) => sum + sa.overall, 0);
  return Math.round((total / session_answers.length) * 10) / 10;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse & validate ─────────────────────────────────────────────────────

  let body: V2ReportRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { session_answers, interview_mode } = body;

  if (!session_answers || !Array.isArray(session_answers) || session_answers.length < 2) {
    return NextResponse.json(
      { error: "At least 2 evaluated answers are required to generate a report." },
      { status: 400 }
    );
  }

  if (session_answers.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 answers per session report." },
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

  // ── Compute numeric summaries server-side ─────────────────────────────────

  const overall_average = computeOverallAverage(session_answers);
  const dimension_averages = computeDimensionAverages(session_answers);

  // ── Build session summary for the model ───────────────────────────────────

  const sessionSummary = session_answers
    .map(
      (sa, i) =>
        `ANSWER ${i + 1}:\nQuestion: ${sa.question}\nScores: ${Object.entries(sa.scores)
          .map(([d, v]) => `${d}=${(v as {score:number}).score}`)
          .join(", ")} | Overall: ${sa.overall}\nStrengths: ${sa.strengths.join("; ")}\nWeaknesses: ${sa.weaknesses.join("; ")}`
    )
    .join("\n\n---\n\n");

  const userMessage = `
Interview mode: ${interview_mode}
Overall average: ${overall_average}
Dimension averages: ${REQUIRED_DIMS.map((d) => `${d}=${dimension_averages[d]}`).join(", ")}

SESSION ANSWERS:
${sessionSummary}
`.trim();

  // ── Groq call ─────────────────────────────────────────────────────────────

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  let rawResponse: unknown = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: FINAL_REPORT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 800,
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

  if (!rawResponse || !isValidReport(rawResponse)) {
    console.error("[v2/report] Failed or invalid response:", lastError ?? rawResponse);
    return NextResponse.json(
      { error: "Failed to generate final report. Please try again." },
      { status: 500 }
    );
  }

  const report: FinalReport = {
    overall_average,
    dimension_averages,
    top_strengths: (rawResponse as { top_strengths: string[] }).top_strengths,
    key_weaknesses: (rawResponse as { key_weaknesses: string[] }).key_weaknesses,
    improvement_plan: (rawResponse as { improvement_plan: string[] }).improvement_plan,
    readiness: (rawResponse as { readiness: ReadinessLevel }).readiness,
    recommendation: (rawResponse as { recommendation: string }).recommendation,
    generated_at: new Date().toISOString(),
  };

  return NextResponse.json(report, { status: 200 });
}
