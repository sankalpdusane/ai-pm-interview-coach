/**
 * v2-types.ts — All TypeScript types exclusive to V2 of the AI PM Coach.
 *
 * V1 types (EvaluationResult, Question, etc.) remain in types.ts untouched.
 * V2 introduces: Interview Modes, enhanced scoring, follow-up questions,
 * session memory tracking, and final report generation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1 — Interview Modes
// ─────────────────────────────────────────────────────────────────────────────

/** The four interview styles a candidate can practice in V2. */
export type InterviewMode =
  | "product_design"
  | "execution"
  | "metrics"
  | "behavioral";

/** Static metadata for rendering mode selector cards in the UI. */
export interface InterviewModeInfo {
  value: InterviewMode;
  label: string;
  description: string;
  icon: string;
  color: string; // Tailwind bg class for active state
}

export const INTERVIEW_MODES: InterviewModeInfo[] = [
  {
    value: "product_design",
    label: "Product Design",
    description: "User needs · CIRCLES/JTBD · trade-offs · feature prioritisation",
    icon: "🎨",
    color: "bg-violet-600",
  },
  {
    value: "execution",
    label: "Execution",
    description: "Prioritisation · roadmap · GTM · stakeholder alignment",
    icon: "⚡",
    color: "bg-blue-600",
  },
  {
    value: "metrics",
    label: "Metrics",
    description: "North star metric · MECE diagnostics · A/B tests · data drops",
    icon: "📊",
    color: "bg-emerald-600",
  },
  {
    value: "behavioral",
    label: "Behavioral",
    description: "STAR method · leadership · conflict · decision under pressure",
    icon: "🧠",
    color: "bg-amber-600",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2 — Enhanced Structured Evaluation
// ─────────────────────────────────────────────────────────────────────────────

/** The four dimensions used in the V2 evaluation rubric. */
export type V2EvaluationDimension =
  | "clarity"
  | "structure"
  | "product_thinking"
  | "depth";

/** Score + feedback for a single V2 evaluation dimension. */
export interface V2DimensionScore {
  /** Integer score 0–10. */
  score: number;
  /** 2–3 sentences of specific, evidence-based feedback. */
  feedback: string;
}

/**
 * Full AI-generated evaluation result from POST /api/v2/evaluate.
 * Extends V1 schema with enhanced dimensions, arrays for strengths/weaknesses,
 * and a built-in follow-up question the model generates simultaneously.
 */
export interface V2EvaluationResult {
  /** Per-dimension scores. */
  scores: Record<V2EvaluationDimension, V2DimensionScore>;
  /** Weighted average of all four dimension scores (0–10, 1 decimal). */
  overall: number;
  /** 2–3 specific strengths observed in the answer. */
  strengths: string[];
  /** 2–3 specific weaknesses or gaps. */
  weaknesses: string[];
  /** 2–3 concrete, actionable improvements. */
  improvements: string[];
  /** The interview mode this evaluation was conducted under. */
  interview_mode: InterviewMode;
  /** ISO 8601 timestamp. */
  evaluated_at: string;
  /** Groq model identifier. */
  model_used: string;
  /** Whether this result was served from the TTL cache. */
  cached: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3 — Follow-up Questions
// ─────────────────────────────────────────────────────────────────────────────

/** Response from POST /api/v2/followup. */
export interface FollowUpResult {
  /** The sharp follow-up question a real FAANG interviewer would ask. */
  question: string;
  /** Which aspect is being probed (trade-offs / metrics / edge cases / depth). */
  focus: string;
  /** ISO 8601 timestamp. */
  generated_at: string;
}

/** Request body for POST /api/v2/followup. */
export interface V2FollowUpRequest {
  question: string;
  answer: string;
  interview_mode: InterviewMode;
  /** Weak areas from session memory — model probes these specifically. */
  weak_areas?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 4 — Session Memory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-side session memory accumulated across evaluations.
 * Passed as context to subsequent /api/v2/evaluate calls so the model
 * knows to probe weaknesses and acknowledge improvements.
 */
export interface SessionMemory {
  /** Recurring weak patterns across evaluations. */
  weak_areas: string[];
  /** Consistent strengths shown across evaluations. */
  consistent_strengths: string[];
  /** Improvements observed since the first evaluation. */
  improvements_made: string[];
}

/** A single completed Q&A within the session — used for report generation. */
export interface SessionAnswer {
  question: string;
  answer: string;
  result: V2EvaluationResult;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 5 — Final Report
// ─────────────────────────────────────────────────────────────────────────────

/** Readiness classification returned in the final report. */
export type ReadinessLevel =
  | "ready"       // ≥7.5 overall average
  | "almost"      // 6–7.4
  | "needs_work"; // <6

/** Full final report from POST /api/v2/report. */
export interface FinalReport {
  /** Average overall score across all session evaluations. */
  overall_average: number;
  /** Per-dimension averages. */
  dimension_averages: Record<V2EvaluationDimension, number>;
  /** Top 2–3 strengths shown consistently across the session. */
  top_strengths: string[];
  /** Key weaknesses that appeared in multiple answers. */
  key_weaknesses: string[];
  /** Specific, numbered improvement plan. */
  improvement_plan: string[];
  /** Readiness assessment. */
  readiness: ReadinessLevel;
  /** One sentence overall recommendation (candid, not softened). */
  recommendation: string;
  /** ISO 8601 timestamp. */
  generated_at: string;
}

/** Request body for POST /api/v2/report. */
export interface V2ReportRequest {
  session_answers: Array<{
    question: string;
    scores: Record<V2EvaluationDimension, V2DimensionScore>;
    overall: number;
    weaknesses: string[];
    strengths: string[];
  }>;
  interview_mode: InterviewMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// API request body types
// ─────────────────────────────────────────────────────────────────────────────

/** Request body for POST /api/v2/evaluate. */
export interface V2EvaluateRequest {
  question: string;
  answer: string;
  interview_mode: InterviewMode;
  /** Optional — injected from client-side session memory. */
  session_memory?: SessionMemory;
}
