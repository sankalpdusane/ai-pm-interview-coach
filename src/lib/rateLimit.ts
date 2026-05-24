/**
 * ============================================================
 * rateLimit.ts — Per-IP API Rate Limiter
 * ============================================================
 *
 * PROBLEM SOLVED:
 *   Prevents a single user (identified by IP) from flooding the
 *   /api/evaluate endpoint, which makes expensive Groq LLM calls.
 *   Without this, a bad actor could burn through API quota in seconds.
 *
 * ALGORITHM — Sliding Window Log:
 *   For each IP we store an array of timestamps (ms) for every request
 *   made within the last RATE_LIMIT_WINDOW_MS milliseconds.
 *   On each incoming request we:
 *     1. Drop timestamps older than `now - window` (the "slide").
 *     2. Count remaining timestamps — if ≥ MAX_REQUESTS, reject.
 *     3. Otherwise push the current timestamp and allow.
 *   This is more accurate than a fixed window (which can allow 2×
 *   the limit at window boundaries) with negligible memory overhead
 *   at 10 req/min per IP.
 *
 * WHY 10 req/min:
 *   A thoughtful PM answer takes at least 2–3 minutes to write.
 *   10 requests/minute is generous for real use while still blocking
 *   automated abuse. It can be raised without changing the algorithm.
 * ============================================================
 */

/** Width of the sliding window in milliseconds (1 minute). */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Maximum number of requests allowed per IP within the window. */
const MAX_REQUESTS = 10;

/**
 * Internal store: maps each IP identifier to the list of request
 * timestamps (Unix ms) that fall within the current sliding window.
 */
const store = new Map<string, number[]>();

/**
 * Remove every IP entry whose entire timestamp list has slid out of the
 * window. Called on every check to prevent unbounded memory growth in
 * long-running Node.js processes.
 */
function purgeStaleEntries(now: number): void {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  for (const [ip, timestamps] of store.entries()) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      store.delete(ip);
    } else {
      store.set(ip, fresh);
    }
  }
}

/**
 * Check whether the given identifier (IP address) is within the allowed
 * request rate. Mutates the internal store on each call.
 *
 * @param identifier - The requester's IP address (or any unique string).
 * @returns `{ allowed: true }` when under the limit, or
 *          `{ allowed: false, retryAfter: ms }` when the limit is hit,
 *          where `retryAfter` is how many milliseconds until the oldest
 *          request slides out of the window.
 */
export function checkRateLimit(
  identifier: string
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  // Sweep stale entries across all IPs on every call.
  purgeStaleEntries(now);

  // Retrieve (or initialise) this IP's request log, trimmed to the window.
  const raw = store.get(identifier) ?? [];
  const timestamps = raw.filter((t) => t > cutoff);

  if (timestamps.length >= MAX_REQUESTS) {
    // Tell the client how long to wait before the oldest request expires.
    const oldestInWindow = Math.min(...timestamps);
    const retryAfter = oldestInWindow + RATE_LIMIT_WINDOW_MS - now;
    return { allowed: false, retryAfter };
  }

  // Record this request and persist.
  timestamps.push(now);
  store.set(identifier, timestamps);
  return { allowed: true };
}
