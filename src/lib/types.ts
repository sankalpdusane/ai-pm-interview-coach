/**
 * The four dimensions along which a PM answer is evaluated by the AI coach.
 * Used as keys in `EvaluationResult.scores`.
 */
export type EvaluationDimension =
  | "structure"
  | "user_empathy"
  | "business_acumen"
  | "communication";

/**
 * The score and qualitative feedback for a single evaluation dimension.
 * Returned as part of `EvaluationResult.scores` for each `EvaluationDimension`.
 */
export interface DimensionScore {
  /** Numeric score from 0 (worst) to 10 (best). */
  score: number;
  /** Qualitative feedback explaining the rating for this dimension. */
  feedback: string;
  /** Optional specific excerpts or examples pulled from the user's answer. */
  examples?: string;
}

/**
 * The complete AI-generated evaluation result for a single PM answer.
 * Returned from `POST /api/evaluate` and stored in the in-memory cache.
 */
export interface EvaluationResult {
  /** Per-dimension breakdown scores, keyed by `EvaluationDimension`. */
  scores: Record<EvaluationDimension, DimensionScore>;
  /** Weighted average of all dimension scores (0–10). */
  overall: number;
  /** The single biggest strength identified in the answer. */
  top_strength: string;
  /** The highest-priority improvement the candidate should make. */
  top_fix: string;
  /** An AI-suggested strong opening line for this type of question. */
  ideal_opening: string;
  /** ISO 8601 timestamp of when the evaluation was generated. */
  evaluated_at: string;
  /** Identifier of the Groq model used to produce this evaluation. */
  model_used: string;
  /** Whether this result was served from the in-memory cache. */
  cached: boolean;
}

/**
 * Categories of PM interview questions supported by the question bank.
 * Used to tag `Question` entries and filter questions in the UI.
 */
export type QuestionCategory =
  | "product_design"
  | "metrics"
  | "strategy"
  | "estimation"
  | "behavioural";

/**
 * The payload sent by the client to `POST /api/evaluate`.
 * Contains the question context and the candidate's raw answer.
 */
export interface EvaluationRequest {
  /** The PM interview question that was posed to the candidate. */
  question: string;
  /** The candidate's answer text to be evaluated. */
  answer: string;
  /** Category of the question, used to tailor the evaluation prompt. */
  category: QuestionCategory;
}

/**
 * A single PM interview question from the question bank (`questions.ts`).
 * Rendered in the UI for the candidate to select and answer.
 */
export interface Question {
  /** Unique identifier for the question (e.g. "pd-001"). */
  id: string;
  /** The full text of the interview question. */
  text: string;
  /** Category this question belongs to. */
  category: QuestionCategory;
  /** Seniority level this question is typically asked at. */
  difficulty: "junior" | "mid" | "senior";
  /** Optional coaching hint shown to the candidate before they answer. */
  hint?: string;
}

/**
 * Generic wrapper used by `cache.ts` to store any value with a TTL.
 * Entries are considered stale when `Date.now() > created_at + ttl`.
 *
 * @template T - The type of the cached payload.
 */
export interface CacheEntry<T> {
  /** The cached value. */
  data: T;
  /** Unix timestamp (ms) when this entry was inserted into the cache. */
  created_at: number;
  /** How long (ms) this entry should remain valid before expiry. */
  ttl: number;
}
