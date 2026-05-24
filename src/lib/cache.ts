/**
 * ============================================================
 * cache.ts — Generic In-Memory TTL Cache
 * ============================================================
 *
 * PROBLEM SOLVED:
 *   Evaluating a PM answer via Groq is slow (~2–4 s) and costs money.
 *   Identical question+answer pairs submitted within 30 minutes should
 *   return the same result instantly without hitting the LLM again.
 *   This cache sits in front of the Groq call inside /api/evaluate.
 *
 * ALGORITHM — TTL Map Cache:
 *   A Map<string, CacheEntry<T>> stores arbitrary data alongside the
 *   Unix-ms timestamp when the entry was created and its TTL duration.
 *   On every read we compare `Date.now()` against `created_at + ttl`:
 *     - Still fresh → return `data`.
 *     - Expired      → delete the entry, return `null`.
 *   A background setInterval sweeps and evicts ALL expired entries every
 *   5 minutes so memory doesn't grow unboundedly between reads.
 *
 * CACHE KEY:
 *   A lightweight deterministic hash — lowercase + normalised whitespace
 *   of (question + answer), truncated to 200 chars, then a charCodeAt
 *   sum mod 1_000_000 — gives a compact numeric-string key with low
 *   collision risk for realistic PM answer lengths.
 *
 * WHY 30-minute TTL:
 *   A candidate rarely rewrites the same answer within half an hour.
 *   30 min balances freshness (model responses don't change hourly) with
 *   memory efficiency. Adjust EVALUATION_TTL_MS to change it globally.
 * ============================================================
 */

import type { CacheEntry } from "./types";

/** How long an evaluation result remains valid in the cache (30 minutes). */
export const EVALUATION_TTL_MS = 1_000 * 60 * 30;

/** How often the background sweep evicts expired entries (5 minutes). */
const CLEANUP_INTERVAL_MS = 1_000 * 60 * 5;

/** The backing store — keyed by a deterministic hash of question+answer. */
const cache = new Map<string, CacheEntry<unknown>>();

// ---------------------------------------------------------------------------
// Core cache operations
// ---------------------------------------------------------------------------

/**
 * Retrieve a cached value by key.
 * Returns `null` when the key is absent or the entry has expired (and
 * removes the stale entry as a side-effect in that case).
 *
 * @template T - Expected type of the cached value.
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const isExpired = Date.now() > entry.created_at + entry.ttl;
  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store a value in the cache under the given key with an explicit TTL.
 *
 * @template T - Type of the value being stored.
 * @param key   - Deterministic cache key (see `generateCacheKey`).
 * @param data  - The value to cache.
 * @param ttlMs - Time-to-live in milliseconds before the entry expires.
 */
export function setCached<T>(key: string, data: T, ttlMs: number): void {
  const entry: CacheEntry<T> = {
    data,
    created_at: Date.now(),
    ttl: ttlMs,
  };
  cache.set(key, entry as CacheEntry<unknown>);
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/**
 * Generate a short, deterministic cache key from a question+answer pair.
 *
 * Steps:
 *  1. Concatenate question and answer with a separator.
 *  2. Lowercase and collapse all whitespace runs to a single space.
 *  3. Truncate to the first 200 characters (long answers don't add entropy).
 *  4. Sum every character's char-code and take mod 1_000_000 to produce
 *     a compact numeric string with negligible collision probability for
 *     realistic PM answer lengths (~100–500 words).
 *
 * @param question - The PM interview question text.
 * @param answer   - The candidate's answer text.
 * @returns A string key like `"482910"`.
 */
export function generateCacheKey(question: string, answer: string): string {
  const normalised = `${question}|||${answer}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  let hash = 0;
  for (let i = 0; i < normalised.length; i++) {
    hash = (hash + normalised.charCodeAt(i)) % 1_000_000;
  }

  return String(hash);
}

// ---------------------------------------------------------------------------
// Background cleanup (SSR-safe)
// ---------------------------------------------------------------------------

/**
 * Evict every entry whose TTL has been exceeded.
 * Runs automatically every CLEANUP_INTERVAL_MS when in a browser/Node
 * runtime; skipped entirely during server-side rendering to avoid
 * spawning timers in environments where they won't be cleared.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.created_at + entry.ttl) {
      cache.delete(key);
    }
  }
}

// Guard: only register the interval in a real runtime (not during SSR/build).
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}
