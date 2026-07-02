/**
 * instrumentation.ts — Next.js 15 server instrumentation hook.
 * Runs on server startup BEFORE any route handler or page is rendered.
 *
 * Purpose: polyfill localStorage/sessionStorage/matchMedia for SSR so that
 * any dependency (including those activated by Node's --localstorage-file flag)
 * gets a safe no-op implementation instead of throwing.
 */
export async function register() {
  if (typeof window !== "undefined") return; // client side — nothing to do

  const store = Object.create(null) as Record<string, string>;

  const safeStorage = {
    getItem:    (k: string): string | null =>
      Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem:    (k: string, v: string) => { store[String(k)] = String(v); },
    removeItem: (k: string) => { delete store[String(k)]; },
    clear:      () => { for (const k in store) delete store[k]; },
    key:        (i: number): string | null => Object.keys(store)[i] ?? null,
    get length(): number { return Object.keys(store).length; },
  };

  // Only polyfill if the native implementation is broken/missing
  try {
    const existing = globalThis.localStorage;
    // Verify it actually works — the --localstorage-file flag creates one that throws
    existing?.getItem("__probe__");
  } catch {
    
    Object.defineProperty(globalThis, "localStorage",   { value: safeStorage, configurable: true, writable: true });
    Object.defineProperty(globalThis, "sessionStorage", { value: safeStorage, configurable: true, writable: true });
    console.log("[instrumentation] localStorage SSR polyfill applied.");
  }

  // matchMedia polyfill — called by some UI libs during SSR
  
  if (typeof globalThis.matchMedia !== "function") {
    globalThis.matchMedia = () => ({
      matches: false, media: "", onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}
