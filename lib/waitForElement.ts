// Generalizes what used to be a single bespoke setInterval poll (the old
// confirm-modal check) into the one mechanism every navigation-triggered
// tour beat uses. Client-side navigation lands the pathname change before
// the new page's data has necessarily fetched - a quote, a scorecard
// computation, a chat textarea behind a loading state - so the anchor a
// beat wants to highlight may not exist in the DOM yet at the moment the
// route changes.
//
// Never a silent dead end: callers get an explicit found/timed-out result,
// not a promise that can only ever resolve. What happens on timeout is the
// caller's decision (skip to the next beat, show fallback copy, etc.), not
// this function's.
const POLL_INTERVAL_MS = 300;

export interface WaitForElementResult {
  found: boolean;
  element: Element | null;
}

export function waitForElement(selector: string, timeoutMs: number): Promise<WaitForElementResult> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve({ found: true, element: existing });
      return;
    }

    const deadline = Date.now() + timeoutMs;
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve({ found: true, element: el });
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(interval);
        resolve({ found: false, element: null });
      }
    }, POLL_INTERVAL_MS);
  });
}
