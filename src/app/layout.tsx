/**
 * layout.tsx — Root layout for AI PM Coach v2
 *
 * localStorage polyfill runs before any module that may access it during SSR.
 * Node.js on this machine is launched with --localstorage-file which creates
 * a broken localStorage shim; we replace it with a safe no-op Map-backed one.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// ── SSR localStorage polyfill (runs at import time, before React renders) ──
if (typeof window === "undefined") {
  const store: Record<string, string> = {};
  const noop = () => undefined;
  // @ts-expect-error — polyfill for SSR environments
  globalThis.localStorage = {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear:      () => { Object.keys(store).forEach(k => delete store[k]); },
    key:        (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
  // @ts-expect-error — polyfill
  globalThis.sessionStorage = globalThis.localStorage;
  // @ts-expect-error — suppress any matchMedia calls during SSR
  globalThis.matchMedia = globalThis.matchMedia ?? (() => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop, dispatchEvent: noop }));
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI PM Interview Coach v2 — Structured Feedback by Llama 3",
  description:
    "Practice product management interviews with AI-powered evaluation across Clarity, Structure, Product Thinking, and Depth. Mode-aware feedback, follow-up questions, session memory & final report. Powered by Groq + Llama 3.1.",
  keywords: [
    "PM interview", "product manager interview prep", "AI coach",
    "FAANG PM", "product thinking", "CIRCLES", "STAR", "MECE", "Groq",
  ],
  openGraph: {
    title: "AI PM Interview Coach v2",
    description: "Elite PM interview practice with Llama 3 AI feedback",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[#09090B]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
