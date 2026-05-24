"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Question, EvaluationResult, QuestionCategory, EvaluationDimension } from "@/lib/types";
import { getRandomQuestion, getQuestionsByCategory } from "@/lib/questions";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { value: QuestionCategory; label: string }[] = [
  { value: "product_design", label: "Product Design" },
  { value: "metrics",        label: "Metrics"         },
  { value: "strategy",       label: "Strategy"        },
  { value: "estimation",     label: "Estimation"      },
  { value: "behavioural",    label: "Behavioural"     },
];

const CATEGORY_SKILLS: Record<QuestionCategory, string> = {
  product_design: "Tests structured thinking, user empathy, and ability to go from problem → insight → solution → trade-offs.",
  metrics:        "Tests whether you can diagnose ambiguous data problems using a MECE diagnostic tree and business context.",
  strategy:       "Tests market awareness, prioritisation instincts, and ability to make and defend a directional recommendation.",
  estimation:     "Tests first-principles thinking, comfort with ambiguity, and ability to make calibrated assumptions under pressure.",
  behavioural:    "Tests self-awareness, influence without authority, and how you handle failure, conflict, or uncertainty.",
};

const DIMENSION_LABELS: Record<EvaluationDimension, string> = {
  structure:       "Structure",
  user_empathy:    "User Empathy",
  business_acumen: "Business Acumen",
  communication:   "Communication",
};

const MAX_CHARS = 3000;
const MIN_CHARS = 40;
const AMBER_THRESHOLD = 2500;

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 7) return "text-emerald-600";
  if (s >= 5) return "text-amber-500";
  return "text-red-500";
}

function scoreBorderColor(s: number) {
  if (s >= 7) return "border-emerald-400";
  if (s >= 5) return "border-amber-400";
  return "border-red-400";
}

function scoreBgBadge(s: number) {
  if (s >= 7) return "bg-emerald-50 text-emerald-700";
  if (s >= 5) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-500";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
        active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
      }`}>
      {label}
    </button>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex-1 min-w-0 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-0.5 truncate">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Question["difficulty"] }) {
  const map = { junior: "bg-emerald-50 text-emerald-700 border-emerald-200", mid: "bg-amber-50 text-amber-700 border-amber-200", senior: "bg-red-50 text-red-700 border-red-200" };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[difficulty]}`}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>;
}

function ScoreMetricCard({ label, score, highlight }: { label: string; score: number; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border py-4 px-2 ${highlight ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
      <span className={`text-2xl font-bold tabular-nums ${highlight ? scoreColor(score).replace("text-", "text-") : scoreColor(score)}`}>{score.toFixed(highlight ? 1 : 0)}</span>
      <span className={`text-xs font-medium mt-1 text-center leading-tight ${highlight ? "text-slate-400" : "text-slate-500"}`}>{label}</span>
    </div>
  );
}

function DimensionCard({ dimension, score, feedback }: { dimension: EvaluationDimension; score: number; feedback: string }) {
  return (
    <div className={`bg-white border-l-4 border border-slate-100 rounded-xl px-5 py-4 ${scoreBorderColor(score)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{DIMENSION_LABELS[dimension]}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreBgBadge(score)}`}>{score}/10</span>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed">{feedback}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface SessionStats {
  count: number;
  totalScore: number;
  history: Array<{ question: string; score: number }>;
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory>("product_design");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showIdealOpening, setShowIdealOpening] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({ count: 0, totalScore: 0, history: [] });

  const resultsRef = useRef<HTMLDivElement>(null);

  const loadRandomQuestion = useCallback((category: QuestionCategory) => {
    setCurrentQuestion(getRandomQuestion(category));
    setAnswer("");
    setResult(null);
    setError(null);
    setShowHint(false);
    setShowIdealOpening(false);
  }, []);

  useEffect(() => { loadRandomQuestion("product_design"); }, [loadRandomQuestion]);

  function handleCategoryChange(category: QuestionCategory) {
    setSelectedCategory(category);
    loadRandomQuestion(category);
  }

  function handleNextQuestion() {
    const pool = getQuestionsByCategory(selectedCategory).filter(q => q.id !== currentQuestion?.id);
    const src = pool.length > 0 ? pool : getQuestionsByCategory(selectedCategory);
    const next = src[Math.floor(Math.random() * src.length)];
    setCurrentQuestion(next);
    setAnswer(""); setResult(null); setError(null); setShowHint(false); setShowIdealOpening(false);
  }

  async function handleEvaluate() {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: currentQuestion?.text, answer, category: selectedCategory }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(response.status === 429
          ? data.error + " This limit exists to keep the service free for everyone."
          : data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(data);
      setSessionStats(prev => ({
        count: prev.count + 1,
        totalScore: prev.totalScore + data.overall,
        history: [...prev.history, { question: (currentQuestion?.text?.slice(0, 60) ?? "") + "…", score: data.overall }],
      }));
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const charCount = answer.length;
  const charCountClass = charCount >= MAX_CHARS ? "text-red-500 font-semibold" : charCount >= AMBER_THRESHOLD ? "text-amber-500 font-medium" : "text-slate-400";
  const canSubmit = answer.trim().length >= MIN_CHARS && answer.length <= MAX_CHARS && !isLoading && !!currentQuestion;
  const avgScore = sessionStats.count > 0 ? (sessionStats.totalScore / sessionStats.count).toFixed(1) : "—";

  const DIMENSIONS: EvaluationDimension[] = ["structure", "user_empathy", "business_acumen", "communication"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Nav */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight">AI PM Coach</span>
          </div>
          <div className="ml-auto">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Powered by Llama&nbsp;3
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Mobile heading */}
        <div className="mb-6 lg:hidden">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI PM Interview Coach</h1>
          <p className="mt-1 text-sm text-slate-500">Get structured feedback powered by Llama&nbsp;3</p>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_1fr] xl:grid-cols-[55%_45%] gap-6 lg:gap-8 items-start">

          {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <div className="hidden lg:block">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight">AI PM Interview Coach</h1>
              <p className="mt-2 text-slate-500 leading-relaxed">Get structured feedback on your answers, powered by Llama&nbsp;3</p>
            </div>

            {/* Category pills */}
            <section aria-label="Select category">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">Category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(({ value, label }) => (
                  <CategoryPill key={value} label={label} active={selectedCategory === value} onClick={() => handleCategoryChange(value)} />
                ))}
              </div>
            </section>

            {/* Question card */}
            <section aria-label="Current question">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Question</span>
                    {currentQuestion && <DifficultyBadge difficulty={currentQuestion.difficulty} />}
                  </div>
                  <span className="text-xs text-slate-400">{currentQuestion?.id ?? "—"}</span>
                </div>
                <div className="px-5 py-5 min-h-[96px]">
                  {currentQuestion
                    ? <p className="text-slate-800 text-base sm:text-lg font-medium leading-relaxed">{currentQuestion.text}</p>
                    : <div className="space-y-3 animate-pulse">{[3,4,2].map((w,i) => <div key={i} className={`h-4 bg-slate-200 rounded w-${w}/4`}/>)}</div>
                  }
                </div>
                {showHint && currentQuestion?.hint && (
                  <div className="mx-5 mb-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 leading-relaxed">
                    <span className="font-semibold">Framework hint: </span>{currentQuestion.hint}
                  </div>
                )}
                <div className="px-5 pb-5 flex flex-wrap gap-2 pt-1">
                  <button onClick={handleNextQuestion} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Next question
                  </button>
                  <button onClick={() => setShowHint(v => !v)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 16v-4m0-4h.01"/></svg>
                    {showHint ? "Hide hint" : "Why this question?"}
                  </button>
                </div>
              </div>
            </section>

            {/* Session stats */}
            <section aria-label="Session statistics">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">Session</p>
              <div className="flex gap-3">
                <StatCard label="Evaluated" value={sessionStats.count} sub="answers" />
                <StatCard label="Avg Score" value={avgScore} sub="out of 10" />
                <StatCard label="Best Score" value={sessionStats.history.length > 0 ? Math.max(...sessionStats.history.map(h => h.score)).toFixed(1) : "—"} />
              </div>
            </section>
          </div>

          {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-24">
            {/* Answer card */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <label htmlFor="answer-textarea" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your answer</label>
                <span className={`text-xs tabular-nums ${charCountClass}`}>{charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
              </div>
              <div className="px-5 pt-4 pb-3">
                <textarea
                  id="answer-textarea"
                  value={answer}
                  onChange={e => { if (e.target.value.length <= MAX_CHARS) setAnswer(e.target.value); }}
                  placeholder={"Speak your answer out loud first. Then type it here.\n\nUse a framework — CIRCLES for product design, STAR for behavioural, 7-step for metrics drops."}
                  disabled={isLoading}
                  rows={10}
                  className="w-full resize-none text-slate-800 placeholder:text-slate-300 text-sm leading-relaxed focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="mx-5 mb-4">
                <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${charCount >= MAX_CHARS ? "bg-red-400" : charCount >= AMBER_THRESHOLD ? "bg-amber-400" : "bg-blue-400"}`}
                    style={{ width: `${Math.min((charCount / MAX_CHARS) * 100, 100)}%` }} />
                </div>
                {charCount > 0 && charCount < MIN_CHARS && (
                  <p className="text-xs text-slate-400 mt-1.5">Write at least {MIN_CHARS - charCount} more characters.</p>
                )}
              </div>
              <div className="px-5 pb-5">
                <button id="evaluate-btn" onClick={handleEvaluate} disabled={!canSubmit}
                  className={`w-full py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${canSubmit ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md active:scale-[0.98]" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4A8 8 0 004 12z"/>
                      </svg>
                      Analysing with Llama&nbsp;3…
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                      Evaluate my answer
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Loading skeleton */}
            {isLoading && (
              <div className="bg-white border border-blue-100 rounded-2xl px-6 py-5">
                <div className="flex items-center gap-2 mb-4">
                  {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${d}ms` }}/>)}
                  <span className="text-sm text-slate-400 ml-1">Analysing your answer…</span>
                </div>
                <div className="space-y-3 animate-pulse">
                  {["w-full","w-4/5","w-3/5"].map((w,i) => <div key={i} className={`h-3 bg-slate-100 rounded-full ${w}`}/>)}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-red-500 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                  <button onClick={handleEvaluate} className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800 underline underline-offset-2">Try again</button>
                </div>
              </div>
            )}

            {/* Pro tip (no result yet) */}
            {!result && !isLoading && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl px-5 py-4">
                <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">💡 Pro tip</p>
                <p className="text-sm text-blue-600 leading-relaxed">{CATEGORY_SKILLS[selectedCategory]}</p>
              </div>
            )}

            {/* ── RESULTS ─────────────────────────────────────────────── */}
            {result && (
              <div ref={resultsRef} className="flex flex-col gap-4 scroll-mt-28">

                {/* Cache badge */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Evaluation Result</h2>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${result.cached ? "bg-violet-50 text-violet-600 border-violet-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${result.cached ? "bg-violet-400" : "bg-emerald-400"}`}/>
                    {result.cached ? "Cached result" : "Fresh evaluation"}
                  </span>
                </div>

                {/* Score overview grid */}
                <div className="grid grid-cols-5 gap-2">
                  {DIMENSIONS.map(dim => (
                    <ScoreMetricCard key={dim} label={DIMENSION_LABELS[dim].split(" ")[0]} score={result.scores[dim].score} />
                  ))}
                  <ScoreMetricCard label="Overall" score={result.overall} highlight />
                </div>

                {/* Dimension cards */}
                <div className="flex flex-col gap-3">
                  {DIMENSIONS.map(dim => (
                    <DimensionCard key={dim} dimension={dim} score={result.scores[dim].score} feedback={result.scores[dim].feedback} />
                  ))}
                </div>

                {/* Strength callout */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex gap-3">
                  <span className="text-emerald-500 text-base shrink-0 mt-0.5">✓</span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Top Strength</p>
                    <p className="text-sm text-emerald-800 leading-relaxed">{result.top_strength}</p>
                  </div>
                </div>

                {/* Fix callout */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3">
                  <span className="text-amber-500 text-base shrink-0 mt-0.5">→</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Top Fix</p>
                    <p className="text-sm text-amber-800 leading-relaxed">{result.top_fix}</p>
                  </div>
                </div>

                {/* Ideal opening expander */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                  <button onClick={() => setShowIdealOpening(v => !v)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800 transition-colors">
                    <span className="text-sm font-semibold text-slate-200">
                      {showIdealOpening ? "Hide ideal opening" : "See how a top-10% candidate would open this"}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showIdealOpening ? "rotate-180" : ""}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  {showIdealOpening && (
                    <div className="px-5 pb-5 pt-1 border-t border-slate-700">
                      <p className="text-sm text-slate-300 leading-relaxed italic">&ldquo;{result.ideal_opening}&rdquo;</p>
                    </div>
                  )}
                </div>

                {/* Try next */}
                <button onClick={handleNextQuestion}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Try another question
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
