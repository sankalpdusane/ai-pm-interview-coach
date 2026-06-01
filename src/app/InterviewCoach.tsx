/**
 * InterviewCoach.tsx — AI PM Interview Coach v2
 * Elite dark UI. Production-grade. Every pixel intentional.
 * Loaded client-side only (no SSR) via page.tsx dynamic import.
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Question, QuestionCategory } from "@/lib/types";
import type {
  InterviewMode,
  V2EvaluationResult,
  V2EvaluationDimension,
  SessionMemory,
  SessionAnswer,
  FinalReport,
  FollowUpResult,
  ReadinessLevel,
} from "@/lib/v2-types";
import { INTERVIEW_MODES } from "@/lib/v2-types";
import { getRandomQuestion, getQuestionsByCategory } from "@/lib/questions";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: { value: QuestionCategory; label: string }[] = [
  { value: "product_design", label: "Product Design" },
  { value: "metrics",        label: "Metrics"        },
  { value: "strategy",       label: "Strategy"       },
  { value: "estimation",     label: "Estimation"     },
  { value: "behavioural",    label: "Behavioural"    },
];

const V2_DIMS: V2EvaluationDimension[] = ["clarity", "structure", "product_thinking", "depth"];

const DIM_META: Record<V2EvaluationDimension, { label: string; shortLabel: string; icon: string }> = {
  clarity:          { label: "Clarity",          shortLabel: "Clarity",   icon: "◎" },
  structure:        { label: "Structure",         shortLabel: "Structure", icon: "⊞" },
  product_thinking: { label: "Product Thinking",  shortLabel: "PM Think",  icon: "◈" },
  depth:            { label: "Depth",             shortLabel: "Depth",     icon: "◉" },
};

const MODE_COLORS: Record<InterviewMode, { gradient: string; border: string; text: string; bg: string }> = {
  product_design: { gradient: "from-violet-500 to-purple-600",  border: "border-violet-500/30",  text: "text-violet-400",  bg: "bg-violet-500/10"  },
  execution:      { gradient: "from-blue-500 to-cyan-600",      border: "border-blue-500/30",    text: "text-blue-400",    bg: "bg-blue-500/10"    },
  metrics:        { gradient: "from-emerald-500 to-teal-600",   border: "border-emerald-500/30", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  behavioral:     { gradient: "from-amber-500 to-orange-500",   border: "border-amber-500/30",   text: "text-amber-400",   bg: "bg-amber-500/10"   },
};

const READINESS_META: Record<ReadinessLevel, { label: string; cls: string }> = {
  ready:      { label: "Interview Ready",      cls: "ready-badge"  },
  almost:     { label: "Almost There",         cls: "almost-badge" },
  needs_work: { label: "Needs More Practice",  cls: "work-badge"   },
};

const MAX_CHARS  = 3000;
const MIN_CHARS  = 40;
const WARN_CHARS = 2500;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function scoreTextColor(s: number) {
  if (s >= 7) return "text-emerald-400";
  if (s >= 5) return "text-amber-400";
  return "text-red-400";
}
function scoreBorderL(s: number) {
  if (s >= 7) return "border-l-emerald-500";
  if (s >= 5) return "border-l-amber-500";
  return "border-l-red-500";
}
function scoreGlowClass(s: number) {
  if (s >= 7) return "score-glow-green";
  if (s >= 5) return "score-glow-amber";
  return "score-glow-red";
}

function mergeDedupe(a: string[], b: string[], max = 5): string[] {
  const seen = new Set(a.map(s => s.toLowerCase().slice(0, 50)));
  const out = [...a];
  for (const item of b) {
    const key = item.toLowerCase().slice(0, 50);
    if (!seen.has(key)) { out.push(item); seen.add(key); }
  }
  return out.slice(0, max);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ScoreBlock({ label, score, highlight = false, animDelay = 0 }: {
  label: string; score: number; highlight?: boolean; animDelay?: number;
}) {
  const textCls = highlight ? "text-indigo-300" : scoreTextColor(score);
  const glowCls = highlight ? "score-glow-indigo" : scoreGlowClass(score);
  return (
    <div
      className={`anim-score flex flex-col items-center justify-center rounded-xl py-3 px-1 border border-white/[0.06] ${highlight ? "bg-indigo-950/40" : "bg-[#111113]"} ${glowCls}`}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <span className={`text-[22px] font-bold tabular-nums leading-none ${textCls}`}>
        {highlight ? score.toFixed(1) : score}
      </span>
      <span className="text-[10px] font-medium mt-1.5 text-center leading-tight text-zinc-500 px-1">
        {label}
      </span>
    </div>
  );
}

function DimCard({ dim, score, feedback, delay = 0 }: {
  dim: V2EvaluationDimension; score: number; feedback: string; delay?: number;
}) {
  const meta = DIM_META[dim];
  return (
    <div
      className={`anim-fade-up border-l-2 border border-white/[0.05] rounded-r-xl px-4 py-3.5 bg-[#111113] ${scoreBorderL(score)}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${scoreTextColor(score)}`}>{meta.icon}</span>
          <span className="text-[13px] font-semibold text-zinc-200">{meta.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${score >= 7 ? "bg-emerald-400" : score >= 5 ? "bg-amber-400" : "bg-red-400"}`}
              style={{ width: `${score * 10}%` }}
            />
          </div>
          <span className={`text-xs font-bold tabular-nums ${scoreTextColor(score)}`}>{score}/10</span>
        </div>
      </div>
      <p className="text-[13px] text-zinc-500 leading-relaxed">{feedback}</p>
    </div>
  );
}

function MemoryTag({ text, variant }: { text: string; variant: "weak" | "strong" }) {
  const cls = variant === "weak"
    ? "bg-red-950/40 text-red-400 border-red-800/30"
    : "bg-emerald-950/40 text-emerald-400 border-emerald-800/30";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium border ${cls}`}>
      {text.length > 44 ? text.slice(0, 41) + "…" : text}
    </span>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex-1 bg-[#111113] border border-white/[0.05] rounded-xl px-4 py-3 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="text-xl font-bold text-zinc-100 mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function ListItem({ text, variant, index }: { text: string; variant: "strength" | "weakness" | "improvement"; index: number }) {
  const map = {
    strength:    { symbol: "✓", cls: "text-emerald-400" },
    weakness:    { symbol: "✗", cls: "text-red-400"     },
    improvement: { symbol: String(index + 1), cls: "text-amber-400 font-bold" },
  };
  const { symbol, cls } = map[variant];
  return (
    <li className="flex gap-2.5 items-start text-[13px] leading-relaxed">
      <span className={`shrink-0 font-semibold text-[12px] mt-0.5 ${cls}`}>{symbol}</span>
      <span className="text-zinc-400">{text}</span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function InterviewCoach() {
  // ── Mode + question ─────────────────────────────────────────────────────
  const [selectedMode, setSelectedMode]         = useState<InterviewMode>("product_design");
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory>("product_design");
  const [currentQuestion, setCurrentQuestion]   = useState<Question | null>(null);
  const [answer, setAnswer]                     = useState("");

  // ── Loading ──────────────────────────────────────────────────────────────
  const [isEvaluating,       setIsEvaluating]       = useState(false);
  const [isLoadingFollowUp,  setIsLoadingFollowUp]  = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // ── Results ──────────────────────────────────────────────────────────────
  const [result,      setResult]      = useState<V2EvaluationResult | null>(null);
  const [followUp,    setFollowUp]    = useState<FollowUpResult | null>(null);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);

  // ── Errors ───────────────────────────────────────────────────────────────
  const [error,       setError]       = useState<string | null>(null);
  const [followUpErr, setFollowUpErr] = useState<string | null>(null);
  const [reportErr,   setReportErr]   = useState<string | null>(null);

  // ── UI flags ─────────────────────────────────────────────────────────────
  const [showReport, setShowReport] = useState(false);
  const [showHint,   setShowHint]   = useState(false);
  const [resultKey,  setResultKey]  = useState(0);

  // ── Session memory ───────────────────────────────────────────────────────
  const [sessionMemory,  setSessionMemory]  = useState<SessionMemory>({
    weak_areas: [], consistent_strengths: [], improvements_made: [],
  });
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const resultsRef  = useRef<HTMLDivElement>(null);
  const reportRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Question loader ──────────────────────────────────────────────────────
  const loadRandomQuestion = useCallback((cat: QuestionCategory) => {
    setCurrentQuestion(getRandomQuestion(cat));
    setAnswer(""); setResult(null); setFollowUp(null);
    setError(null); setFollowUpErr(null); setShowHint(false);
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  useEffect(() => { loadRandomQuestion("product_design"); }, [loadRandomQuestion]);

  function nextQuestion() {
    const pool = getQuestionsByCategory(selectedCategory).filter(q => q.id !== currentQuestion?.id);
    const src  = pool.length > 0 ? pool : getQuestionsByCategory(selectedCategory);
    setCurrentQuestion(src[Math.floor(Math.random() * src.length)]);
    setAnswer(""); setResult(null); setFollowUp(null);
    setError(null); setFollowUpErr(null); setShowHint(false);
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  // ── Feature 2 + 4: Evaluate ─────────────────────────────────────────────
  async function handleEvaluate() {
    setIsEvaluating(true);
    setError(null); setResult(null); setFollowUp(null); setFollowUpErr(null);
    try {
      const res = await fetch("/api/v2/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion?.text,
          answer,
          interview_mode: selectedMode,
          session_memory: sessionMemory.weak_areas.length > 0 ? sessionMemory : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 429
          ? data.error + " This limit keeps the service free for everyone."
          : data.error ?? "Something went wrong. Please try again.");
        return;
      }
      const evalResult = data as V2EvaluationResult;
      setResult(evalResult);
      setResultKey(k => k + 1);
      setSessionMemory(prev => ({
        weak_areas:           mergeDedupe(prev.weak_areas,           evalResult.weaknesses),
        consistent_strengths: mergeDedupe(prev.consistent_strengths, evalResult.strengths),
        improvements_made:    prev.improvements_made,
      }));
      setSessionAnswers(prev => [...prev, {
        question: currentQuestion?.text ?? "",
        answer,
        result: evalResult,
        timestamp: new Date().toISOString(),
      }]);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsEvaluating(false);
    }
  }

  // ── Feature 3: Follow-up ────────────────────────────────────────────────
  async function handleFollowUp() {
    if (!result || !currentQuestion) return;
    setIsLoadingFollowUp(true); setFollowUpErr(null);
    try {
      const res = await fetch("/api/v2/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion.text, answer, interview_mode: selectedMode,
          weak_areas: sessionMemory.weak_areas.slice(0, 3),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFollowUpErr(data.error ?? "Failed to generate."); return; }
      setFollowUp(data as FollowUpResult);
    } catch { setFollowUpErr("Network error."); }
    finally  { setIsLoadingFollowUp(false); }
  }

  // ── Feature 5: Report ───────────────────────────────────────────────────
  async function handleReport() {
    if (sessionAnswers.length < 2) return;
    setIsGeneratingReport(true); setReportErr(null); setFinalReport(null);
    try {
      const res = await fetch("/api/v2/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_answers: sessionAnswers.map(sa => ({
            question: sa.question, scores: sa.result.scores, overall: sa.result.overall,
            strengths: sa.result.strengths, weaknesses: sa.result.weaknesses,
          })),
          interview_mode: selectedMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setReportErr(data.error ?? "Failed to generate report."); return; }
      setFinalReport(data as FinalReport);
      setShowReport(true);
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch { setReportErr("Network error."); }
    finally  { setIsGeneratingReport(false); }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const charCount    = answer.length;
  const charPct      = Math.min((charCount / MAX_CHARS) * 100, 100);
  const isOverWarn   = charCount >= WARN_CHARS;
  const canSubmit    = answer.trim().length >= MIN_CHARS && charCount <= MAX_CHARS && !isEvaluating && !!currentQuestion;
  const avgScore     = sessionAnswers.length > 0
    ? (sessionAnswers.reduce((s, sa) => s + sa.result.overall, 0) / sessionAnswers.length).toFixed(1) : "—";
  const bestScore    = sessionAnswers.length > 0
    ? Math.max(...sessionAnswers.map(sa => sa.result.overall)).toFixed(1) : "—";
  const modeColors   = MODE_COLORS[selectedMode];
  const modeInfo     = INTERVIEW_MODES.find(m => m.value === selectedMode)!;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#09090B]">

      {/* ══════════════════════════ NAV ═════════════════════════════════════ */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#09090B]/85 backdrop-blur-xl">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-14 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-white">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <span className="font-semibold text-[15px] text-zinc-100 tracking-tight">AI PM Coach</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800/60 tracking-wide">V2</span>
          </div>

          {/* Current mode pill */}
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${modeColors.border} ${modeColors.bg} ${modeColors.text}`}>
            <span>{modeInfo.icon}</span>
            <span>{modeInfo.label}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Report CTA */}
            {sessionAnswers.length >= 2 && (
              <button
                onClick={handleReport}
                disabled={isGeneratingReport}
                className="hidden sm:flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-indigo-900/30"
              >
                {isGeneratingReport
                  ? <><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4A8 8 0 004 12z"/></svg>Generating…</>
                  : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6M5 20h14a2 2 0 002-2V7l-5-5H5a2 2 0 00-2 2v13a2 2 0 002 2z"/></svg>Session Report</>
                }
              </button>
            )}
            {/* Status */}
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dot-pulse" />
              <span className="hidden sm:inline">Llama 3.1 · Groq</span>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════ FEATURE 1 — MODE SELECTOR ═══════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-8 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">Interview Mode</span>
          <div className="h-px flex-1 bg-white/[0.04]" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {INTERVIEW_MODES.map((mode, i) => {
            const isActive = selectedMode === mode.value;
            const mc       = MODE_COLORS[mode.value];
            return (
              <button
                key={mode.value}
                onClick={() => {
                  setSelectedMode(mode.value);
                  if (mode.value === "product_design") setSelectedCategory("product_design");
                  else if (mode.value === "metrics")   setSelectedCategory("metrics");
                  else if (mode.value === "behavioral") setSelectedCategory("behavioural");
                }}
                className={`relative group rounded-2xl p-4 text-left transition-all duration-300 border
                  ${isActive
                    ? `${mc.border} mode-card-active shadow-lg`
                    : "border-white/[0.06] bg-[#111113] hover:border-white/[0.12] hover:bg-[#161618]"
                  }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3
                  ${isActive ? `bg-gradient-to-br ${mc.gradient} shadow-lg` : "bg-white/[0.05] group-hover:bg-white/[0.08]"}
                  transition-all duration-300`}>
                  {mode.icon}
                </div>
                <p className={`text-[13px] font-semibold mb-0.5 transition-colors duration-200 ${isActive ? mc.text : "text-zinc-300"}`}>
                  {mode.label}
                </p>
                <p className="text-[11px] text-zinc-600 leading-snug">{mode.description}</p>
                {isActive && (
                  <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${mc.gradient}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════ MAIN 2-COLUMN GRID ══════════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[52%_48%] gap-6 items-start">

          {/* ════════ LEFT PANEL ════════ */}
          <div className="flex flex-col gap-5">

            {/* Heading — desktop only */}
            <div className="hidden lg:block">
              <h1 className="text-[28px] font-bold text-zinc-100 tracking-tight">AI PM Interview Coach</h1>
              <p className="mt-1 text-[13px] text-zinc-600 max-w-md leading-relaxed">
                Practising in{" "}
                <span className={`font-semibold ${modeColors.text}`}>{modeInfo.label}</span>{" "}
                mode — {modeInfo.description}
              </p>
            </div>

            {/* Category pills */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">Category</span>
                <div className="h-px flex-1 bg-white/[0.04]" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => { setSelectedCategory(value); loadRandomQuestion(value); }}
                    className={`h-8 px-3.5 rounded-lg text-[12px] font-medium transition-all duration-200 border
                      ${selectedCategory === value
                        ? "bg-indigo-950/60 text-indigo-300 border-indigo-700/50"
                        : "bg-transparent text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:border-white/[0.12]"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question card */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">Question</span>
                  {currentQuestion && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border
                      ${currentQuestion.difficulty === "junior"
                        ? "bg-emerald-950/40 text-emerald-500 border-emerald-800/30"
                        : currentQuestion.difficulty === "mid"
                        ? "bg-amber-950/40 text-amber-500 border-amber-800/30"
                        : "bg-red-950/40 text-red-500 border-red-800/30"
                      }`}>
                      {currentQuestion.difficulty.charAt(0).toUpperCase() + currentQuestion.difficulty.slice(1)}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-700 font-mono">{currentQuestion?.id ?? "—"}</span>
              </div>

              <div className="px-5 py-5 min-h-[88px]">
                {currentQuestion
                  ? <p className="text-[15px] sm:text-[16px] font-medium text-zinc-200 leading-relaxed">{currentQuestion.text}</p>
                  : <div className="space-y-2.5 animate-pulse">
                      {[70, 90, 50].map((w, i) => (
                        <div key={i} className="h-3.5 bg-white/[0.06] rounded-md" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                }
              </div>

              {showHint && currentQuestion?.hint && (
                <div className="mx-5 mb-4 px-4 py-3 rounded-xl bg-indigo-950/30 border border-indigo-800/25 anim-fade-up">
                  <p className="text-[12px] text-indigo-300 leading-relaxed">
                    <span className="font-semibold">Framework hint: </span>{currentQuestion.hint}
                  </p>
                </div>
              )}

              <div className="px-5 pb-4 flex gap-2">
                <button
                  onClick={nextQuestion}
                  className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] font-medium text-zinc-400 bg-white/[0.04] hover:bg-white/[0.08] hover:text-zinc-200 border border-white/[0.06] transition-all duration-200"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  Next
                </button>
                <button
                  onClick={() => setShowHint(v => !v)}
                  className={`flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] font-medium border transition-all duration-200
                    ${showHint ? "text-indigo-300 bg-indigo-950/40 border-indigo-800/30" : "text-zinc-500 bg-white/[0.04] border-white/[0.06] hover:text-zinc-300"}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 16v-4m0-4h.01"/>
                  </svg>
                  {showHint ? "Hide hint" : "Framework hint"}
                </button>
              </div>
            </div>

            {/* Feature 4: Session memory */}
            {sessionMemory.weak_areas.length > 0 && (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111113] overflow-hidden anim-fade-up">
                <div className="px-5 py-3 border-b border-white/[0.05] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dot-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">AI is tracking your progress</span>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-2">Recurring weak areas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sessionMemory.weak_areas.map((a, i) => <MemoryTag key={i} text={a} variant="weak" />)}
                    </div>
                  </div>
                  {sessionMemory.consistent_strengths.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-2">Consistent strengths</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sessionMemory.consistent_strengths.slice(0, 3).map((s, i) => <MemoryTag key={i} text={s} variant="strong" />)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Session stats */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">Session</span>
                <div className="h-px flex-1 bg-white/[0.04]" />
              </div>
              <div className="flex gap-3">
                <StatBox label="Evaluated" value={sessionAnswers.length} sub="answers"  />
                <StatBox label="Avg Score"  value={avgScore}             sub="/ 10"     />
                <StatBox label="Best Score" value={bestScore}                            />
              </div>
            </div>

            {/* Mobile report button */}
            {sessionAnswers.length >= 2 && (
              <button onClick={handleReport} disabled={isGeneratingReport}
                className="sm:hidden w-full h-10 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {isGeneratingReport ? "Generating…" : "Generate Session Report"}
              </button>
            )}
          </div>

          {/* ════════ RIGHT PANEL ════════ */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-20">

            {/* Answer card */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111113] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                <label htmlFor="answer-area" className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">Your Answer</label>
                <span className={`text-[11px] tabular-nums font-mono transition-colors duration-300
                  ${charCount >= MAX_CHARS ? "text-red-400" : isOverWarn ? "text-amber-400" : "text-zinc-600"}`}>
                  {charCount.toLocaleString()}/{MAX_CHARS.toLocaleString()}
                </span>
              </div>

              <div className="px-5 pt-4 pb-2">
                <textarea
                  ref={textareaRef}
                  id="answer-area"
                  value={answer}
                  onChange={e => { if (e.target.value.length <= MAX_CHARS) setAnswer(e.target.value); }}
                  disabled={isEvaluating}
                  rows={11}
                  placeholder={"Speak it out loud first. Then type here.\n\nUse a framework — CIRCLES for design, STAR for behavioural, MECE for metrics."}
                  className="w-full bg-transparent resize-none text-[14px] text-zinc-300 leading-relaxed focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>

              <div className="mx-5 mb-3">
                <div className="h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={isOverWarn ? "progress-bar-amber h-full rounded-full" : "progress-bar h-full rounded-full"}
                    style={{ width: `${charPct}%` }}
                  />
                </div>
                {charCount > 0 && charCount < MIN_CHARS && (
                  <p className="text-[11px] text-zinc-600 mt-1.5">{MIN_CHARS - charCount} more characters needed</p>
                )}
              </div>

              <div className="px-5 pb-5">
                <button
                  id="evaluate-btn"
                  onClick={handleEvaluate}
                  disabled={!canSubmit}
                  className={`relative w-full h-11 rounded-xl text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 overflow-hidden
                    ${canSubmit ? "btn-evaluate text-white shadow-lg shadow-indigo-900/30" : "bg-white/[0.04] text-zinc-600 cursor-not-allowed border border-white/[0.05]"}`}
                >
                  {isEvaluating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin relative z-10" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4A8 8 0 004 12z"/>
                      </svg>
                      <span className="relative z-10">Analysing with Llama 3…</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 relative z-10">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                      <span className="relative z-10">Evaluate my answer</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Loading skeleton */}
            {isEvaluating && (
              <div className="rounded-2xl border border-indigo-900/30 bg-[#0D0D12] px-5 py-4 anim-fade-in">
                <div className="flex items-center gap-1.5 mb-4">
                  {[0, 180, 360].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                      style={{ animation: `bounce-dot 1.2s ease-in-out ${d}ms infinite` }} />
                  ))}
                  <span className="text-[12px] text-zinc-600 ml-1.5">Analysing your answer…</span>
                </div>
                <div className="space-y-2">
                  {["100%","75%","55%"].map((w, i) => (
                    <div key={i} className="shimmer h-2.5 rounded-full" style={{ width: w }} />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && !isEvaluating && (
              <div role="alert" className="rounded-2xl border border-red-900/30 bg-red-950/20 px-5 py-4 flex gap-3 anim-fade-up">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-red-500 shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                </svg>
                <div>
                  <p className="text-[13px] text-red-300">{error}</p>
                  <button onClick={handleEvaluate} className="mt-1.5 text-[11px] font-semibold text-red-500 hover:text-red-300 underline underline-offset-2 transition-colors">
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Empty state tip */}
            {!result && !isEvaluating && !error && (
              <div className={`rounded-2xl border px-5 py-4 anim-fade-in ${modeColors.border} ${modeColors.bg}`}>
                <p className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5 ${modeColors.text}`}>
                  {modeInfo.icon}&nbsp; {modeInfo.label} Mode
                </p>
                <p className="text-[12px] text-zinc-500 leading-relaxed">{modeInfo.description}</p>
              </div>
            )}

            {/* ══════════ FEATURE 2: RESULTS ══════════ */}
            {result && (
              <div key={resultKey} ref={resultsRef} className="flex flex-col gap-3 scroll-mt-24">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">Evaluation</span>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border ${modeColors.border} ${modeColors.bg} ${modeColors.text}`}>
                      {modeInfo.icon} {modeInfo.label}
                    </span>
                    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border
                      ${result.cached ? "bg-violet-950/30 text-violet-400 border-violet-800/30" : "bg-emerald-950/30 text-emerald-400 border-emerald-800/30"}`}>
                      <span className={`w-1 h-1 rounded-full ${result.cached ? "bg-violet-400" : "bg-emerald-400"}`} />
                      {result.cached ? "cached" : "fresh"}
                    </span>
                  </div>
                </div>

                {/* Score grid */}
                <div className="grid grid-cols-5 gap-2">
                  {V2_DIMS.map((dim, i) => (
                    <ScoreBlock key={dim} label={DIM_META[dim].shortLabel} score={result.scores[dim].score} animDelay={i * 60} />
                  ))}
                  <ScoreBlock label="Overall" score={result.overall} highlight animDelay={V2_DIMS.length * 60} />
                </div>

                {/* Dimension feedback */}
                <div className="flex flex-col gap-2">
                  {V2_DIMS.map((dim, i) => (
                    <DimCard key={dim} dim={dim} score={result.scores[dim].score} feedback={result.scores[dim].feedback} delay={i * 60} />
                  ))}
                </div>

                {/* Strengths / Weaknesses / Improvements */}
                {([
                  { title: "Strengths",    items: result.strengths,    variant: "strength"    as const, borderCls: "border-emerald-900/40", bgCls: "bg-emerald-950/15" },
                  { title: "Weaknesses",   items: result.weaknesses,   variant: "weakness"    as const, borderCls: "border-red-900/40",     bgCls: "bg-red-950/15"     },
                  { title: "Improvements", items: result.improvements, variant: "improvement" as const, borderCls: "border-amber-900/40",   bgCls: "bg-amber-950/15"   },
                ] as const).map(({ title, items, variant, borderCls, bgCls }) => (
                  <div key={title} className={`rounded-xl border px-4 py-3.5 anim-fade-up ${borderCls} ${bgCls}`}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-2.5">{title}</p>
                    <ul className="space-y-1.5">
                      {items.map((item, i) => <ListItem key={i} text={item} variant={variant} index={i} />)}
                    </ul>
                  </div>
                ))}

                {/* Feature 3: Follow-up */}
                <div className="terminal-card rounded-2xl overflow-hidden anim-fade-up">
                  <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-zinc-300">Interviewer Follow-up</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">What a FAANG PM would probe next</p>
                    </div>
                    {!followUp && (
                      <button
                        onClick={handleFollowUp}
                        disabled={isLoadingFollowUp}
                        className="shrink-0 h-8 px-4 rounded-lg text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/40 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isLoadingFollowUp
                          ? <><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4A8 8 0 004 12z"/></svg>Thinking…</>
                          : <>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                              Get Follow-up
                            </>
                        }
                      </button>
                    )}
                  </div>
                  {followUpErr && (
                    <div className="px-5 pb-4 border-t border-white/[0.04]">
                      <p className="text-[11px] text-red-500 mt-3">{followUpErr}</p>
                    </div>
                  )}
                  {followUp && (
                    <div className="px-5 pb-5 pt-3 border-t border-white/[0.04] anim-fade-up">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">probing</span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-indigo-950/60 text-indigo-400 border border-indigo-800/30">
                          {followUp.focus.replace(/-/g, " ")}
                        </span>
                      </div>
                      <p className="text-[14px] text-zinc-200 leading-relaxed font-medium">
                        &ldquo;{followUp.question}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                {/* Next question */}
                <button
                  onClick={nextQuestion}
                  className="w-full h-10 rounded-xl text-[13px] font-medium text-zinc-500 bg-white/[0.03] hover:bg-white/[0.06] hover:text-zinc-300 border border-white/[0.05] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  Try another question
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════ FEATURE 5: FINAL REPORT ══════════════════════ */}
        {showReport && finalReport && (
          <div ref={reportRef} className="mt-10 scroll-mt-20 anim-scale-in">
            <div className="rounded-2xl border border-white/[0.07] bg-[#111113] overflow-hidden">
              <div className="px-6 py-5 border-b border-white/[0.05] flex items-center justify-between">
                <div>
                  <h2 className="text-[18px] font-bold text-zinc-100">Session Report</h2>
                  <p className="text-[12px] text-zinc-600 mt-0.5">
                    {sessionAnswers.length} answer{sessionAnswers.length !== 1 ? "s" : ""} · {modeInfo.label} mode
                  </p>
                </div>
                <button onClick={() => setShowReport(false)} className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-zinc-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Overall + readiness */}
                <div className="flex items-end justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-700 mb-2">Overall Average</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-[54px] font-bold tabular-nums leading-none ${scoreTextColor(finalReport.overall_average)}`}>
                        {finalReport.overall_average}
                      </span>
                      <span className="text-[20px] text-zinc-700 font-medium">/10</span>
                    </div>
                  </div>
                  <span className={`px-4 py-2 rounded-xl text-[13px] font-bold ${READINESS_META[finalReport.readiness].cls}`}>
                    {finalReport.readiness === "ready" ? "✓" : finalReport.readiness === "almost" ? "◎" : "✗"}{" "}
                    {READINESS_META[finalReport.readiness].label}
                  </span>
                </div>

                {/* Dimension averages */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-700 mb-3">Dimension Averages</p>
                  <div className="grid grid-cols-4 gap-3">
                    {V2_DIMS.map((dim, i) => (
                      <ScoreBlock key={dim} label={DIM_META[dim].shortLabel} score={finalReport.dimension_averages[dim]} animDelay={i * 50} />
                    ))}
                  </div>
                </div>

                {/* Dimension bars */}
                <div className="space-y-2">
                  {V2_DIMS.map(dim => (
                    <div key={dim} className="flex items-center gap-3">
                      <span className="text-[11px] text-zinc-600 w-24 shrink-0">{DIM_META[dim].label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${finalReport.dimension_averages[dim] >= 7 ? "bg-emerald-400" : finalReport.dimension_averages[dim] >= 5 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${finalReport.dimension_averages[dim] * 10}%` }}
                        />
                      </div>
                      <span className={`text-[12px] font-bold tabular-nums w-8 text-right ${scoreTextColor(finalReport.dimension_averages[dim])}`}>
                        {finalReport.dimension_averages[dim]}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Strengths + Weaknesses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700 mb-3">✓ Top Strengths</p>
                    <ul className="space-y-2">
                      {finalReport.top_strengths.map((s, i) => (
                        <li key={i} className="text-[12px] text-zinc-400 flex gap-2 leading-relaxed">
                          <span className="text-emerald-500 shrink-0">•</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-red-900/30 bg-red-950/10 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-700 mb-3">✗ Key Weaknesses</p>
                    <ul className="space-y-2">
                      {finalReport.key_weaknesses.map((w, i) => (
                        <li key={i} className="text-[12px] text-zinc-400 flex gap-2 leading-relaxed">
                          <span className="text-red-500 shrink-0">•</span>{w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Improvement plan */}
                <div className="terminal-card rounded-xl px-6 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-4">Your Improvement Plan</p>
                  <ol className="space-y-3.5">
                    {finalReport.improvement_plan.map((step, i) => (
                      <li key={i} className="flex gap-3.5 text-[13px] text-zinc-400 leading-relaxed">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5 shadow-lg shadow-indigo-900/40">{i + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Recommendation */}
                <div className="border-t border-white/[0.05] pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-700 mb-2">Recommendation</p>
                  <p className="text-[13px] text-zinc-400 leading-relaxed italic">&ldquo;{finalReport.recommendation}&rdquo;</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report error */}
        {reportErr && (
          <div role="alert" className="mt-6 rounded-2xl border border-red-900/30 bg-red-950/10 px-5 py-4 flex gap-3 anim-fade-up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-red-500 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
            </svg>
            <div>
              <p className="text-[13px] text-red-300">{reportErr}</p>
              <button onClick={handleReport} className="mt-1.5 text-[11px] text-red-500 hover:text-red-300 underline underline-offset-2 transition-colors">Try again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
