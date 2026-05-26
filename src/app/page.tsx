"use client";
/**
 * page.tsx — Client wrapper that loads the full V2 UI with ssr:false.
 * Must be a Client Component so that next/dynamic with ssr:false works
 * in the Next.js App Router.
 */
import dynamic from "next/dynamic";

const InterviewCoach = dynamic(() => import("./InterviewCoach"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/50 animate-pulse">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
        </div>
        <p className="text-[13px] text-zinc-600 font-medium tracking-wide">Loading AI PM Coach…</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <InterviewCoach />;
}
