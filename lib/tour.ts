// ============================================================================
// Guided tour: fixed symbol, phase model, and step copy
// ============================================================================
// The tour is not a scripted click-sequence with its own step counter - it
// derives what to show from the user's REAL portfolio/journal state
// (lib/PortfolioContext.tsx, hooks/useJournal.ts). That's what makes it
// resumable and tolerant of going off-script for free: there's no separate
// "step 4 of 7" to desync from reality. See the design writeup this file
// implements for the full reasoning.

// Parked, not deleted - beat 5 (thesis/buy) took four rounds of fixes
// (button labels, driver.js's page-wide interaction lockout, the
// pathname-mismatch invariant, the scroll trap on tall forms/modals).
// Flip back to true to resume work; nothing else needs to change. Checked
// at the three surfaces that make the tour visible: GuidedTour (renders
// nothing), TourPrompt (shows neither the start nor resume card), and
// Settings' Guided Tour replay section (hidden entirely).
export const TOUR_ENABLED = true;

// One fixed symbol for every attendee, not a free choice - this is what
// lets 30 concurrent tour-takers share one 15s-TTL quote cache (see
// lib/marketDataCache.ts) instead of each cold-starting a distinct symbol.
// AAPL specifically: the same symbol the marketing page's own hero mockup
// already shows (components/marketing/Hero.tsx), and about as
// universally recognizable as a cold, general demo audience gets.
export const TOUR_SYMBOL = "AAPL";

export type TourPhase =
  | "loading"
  | "guest" // signed out - beats 2/3 need a real portfolio row, which guests never get
  | "not_started" // signed in, never dismissed, no tour-symbol activity yet
  | "need_buy" // actively touring, no transaction in TOUR_SYMBOL yet
  | "holding_open" // bought, not yet sold
  | "closed_awaiting_critique" // sold (episode closed) - reflection + critique are both in flight
  | "critique_ready" // critique text landed - point at the benchmark, then finish
  | "dismissed"; // finished or skipped - stay out of the way

export interface TourPhaseInput {
  authStatus: "loading" | "authenticated" | "unauthenticated";
  tourDismissedAt: string | null | undefined; // undefined = still loading
  active: boolean; // user has explicitly started this run (prompt accepted or replay clicked)
  hasTourSymbolTransaction: boolean;
  holdsTourSymbol: boolean;
  closedTourSymbolEpisode: { id: string; critique: string | null } | null;
}

export function deriveTourPhase(input: TourPhaseInput): TourPhase {
  if (input.authStatus === "loading" || input.tourDismissedAt === undefined) return "loading";
  if (input.authStatus !== "authenticated") return "guest";
  if (input.tourDismissedAt !== null && !input.active) return "dismissed";

  if (input.closedTourSymbolEpisode) {
    return input.closedTourSymbolEpisode.critique ? "critique_ready" : "closed_awaiting_critique";
  }
  if (input.holdsTourSymbol) return "holding_open";
  if (input.active || input.hasTourSymbolTransaction) return "need_buy";
  return "not_started";
}

// ============================================================================
// Beat list: explicit sequencing for the navigation beats, phase-driven
// reconciliation for the doing beats
// ============================================================================
// deriveTourPhase above still owns "is this trade actually done" - it isn't
// replaced by this. What's added here is the layer phase alone can't
// express: "has this account seen the Krix page yet" has no server-side
// fact to derive from, only an explicit position in an ordered list does.
// See PHASE_MIN_INDEX/reconcileStepIndex below for how the two meet:
// forward-only, real state corrects the persisted index, never the reverse.
export interface TourBeat {
  id: string;
  page: string;
  /** CSS selector for this beat's anchor. Null only for the closing beat, which has none. */
  element: string | null;
  /** Only journal-critique needs this - its anchor id depends on which episode closed. */
  resolveElement?: (ctx: { closedEpisodeId: string | null }) => string | null;
  title: string;
  description: string;
  /**
   * "info": click-through, advances on the user's own Next click - nothing
   * in the app enforces that they actually did what the copy suggests.
   * "doing": advances only on real state - the user's own click can never
   * skip it, so it gets no Next/Done button (see GuidedTour.tsx).
   */
  kind: "info" | "doing";
  /**
   * Doing beats whose OWN element already exists (unlike trading-buy-fill,
   * whose anchor doesn't exist until the confirm modal opens) but that
   * still shouldn't be click-advanceable - e.g. "write a thesis, then buy"
   * has no button because clicking Next would dismiss the instruction
   * without the user having done it. Instead this beat's popover stays on
   * its own `element` and polls indefinitely for `advanceWhen` to appear,
   * then auto-advances - same never-time-out philosophy as any other doing
   * beat, just watching a different selector than the one it's anchored to.
   */
  advanceWhen?: string;
}

export const TOUR_BEATS: TourBeat[] = [
  {
    id: "dashboard-intro",
    page: "/dashboard",
    element: "#tour-portfolio-snapshot",
    title: "Welcome to your $100,000",
    description:
      "Fake money, real prices. Everything from here on is about whether your reasoning holds up, not whether you get lucky.",
    kind: "info",
  },
  {
    id: "trading-symbol",
    page: "/trading",
    element: "#tour-symbol-picker",
    title: "We picked AAPL for you",
    description: "One fixed stock keeps this quick - trade others later, just not today.",
    kind: "info",
  },
  {
    id: "stock-detail",
    page: `/stocks/${TOUR_SYMBOL}`,
    element: "#tour-stock-detail",
    title: "Research before you commit",
    description: "Price history and news - the same data a real trade would be based on.",
    kind: "info",
  },
  {
    id: "trading-shares",
    page: "/trading",
    element: "#tour-shares-input",
    title: "Just 1 share",
    description: "Small on purpose - this is about the mechanics, not the money.",
    kind: "info",
  },
  {
    id: "trading-thesis",
    // Highlights the whole order ticket, not just #tour-thesis-form - driver.js
    // sets pointer-events:none on everything outside its highlighted element
    // (see its own driver.css), so a narrower highlight would make the
    // "place the order" button this beat is waiting on unclickable while
    // the popover is up. Same reasoning for trading-sell/trading-buy-fill/
    // trading-sell-fill below.
    page: "/trading",
    element: "#tour-order-ticket",
    // No advanceWhen, and no separate "quote vs fill" beat after this one.
    // That beat was anchored to the confirm modal, which is destroyed by the
    // very click it asks for - and PHASE_MIN_INDEX force-advances past it the
    // instant the trade lands, so it was structurally unreachable. Its
    // teaching is folded into this copy instead, and this beat now waits on
    // the trade actually completing (via reconciliation) rather than on the
    // modal merely opening.
    title: "Why this, why now",
    description:
      "Fill this in, then place the order. On the confirm screen, watch the gap between Quoted price and Est. fill price - that's spread and slippage, modeled honestly instead of hidden.",
    kind: "doing",
  },
  {
    id: "portfolio-position",
    page: "/portfolio",
    element: "#tour-holdings-table",
    title: "Your position, live",
    description: "Marked to the current price, not what you paid - this updates as the market moves.",
    kind: "info",
  },
  {
    id: "trading-sell",
    page: "/trading",
    element: "#tour-order-ticket",
    // Same merge as trading-thesis above - the modal-anchored "other half of
    // the round trip" beat was unreachable for the same reason.
    title: "Now sell it back",
    description:
      "Switch this to Sell and place the order. You'll receive a little less than the quote - entering and exiting both cost something, always. The small loss on the round trip is the honest cost of trading, not a mistake.",
    kind: "doing",
  },
  {
    id: "journal-critique",
    page: "/journal",
    element: null,
    resolveElement: ({ closedEpisodeId }) => (closedEpisodeId ? `#episode-${closedEpisodeId}` : null),
    title: "Tag how it played out",
    description: "Krix is already writing your critique - it'll appear here in a few seconds, whether you tag this or not.",
    kind: "doing",
  },
  {
    id: "scorecard",
    page: "/journal/scorecard",
    element: "#tour-scorecard-headline",
    title: "This is where it all adds up",
    description:
      "Win rate, execution cost, whether you're beating the index - most of it needs more history than one trade, but it's already tracking.",
    kind: "info",
  },
  {
    id: "dashboard-benchmark",
    page: "/dashboard",
    element: "#tour-benchmark-card",
    title: "This is what fills in over time",
    description:
      "Every closed position gets measured against just buying the S&P 500 - and after 10, your full scorecard unlocks.",
    kind: "info",
  },
  {
    id: "dashboard-news",
    page: "/dashboard",
    element: "#tour-news-widget",
    title: "Market context, in one place",
    description: "Headlines on what you hold and what's moving broadly - ask Krix for more on demand.",
    kind: "info",
  },
  {
    id: "krix",
    page: "/ai",
    element: "#tour-chat-input",
    title: "Ask Krix anything",
    description: "Research a stock, get a second opinion, or ask it to propose a full trade plan - you review before anything executes.",
    kind: "info",
  },
  {
    id: "settings-replay",
    page: "/settings",
    element: "#tour-settings-replay",
    title: "Come back anytime",
    description: "Reset your portfolio and replay this tour whenever you want a clean run.",
    kind: "info",
  },
  {
    id: "close",
    page: "/settings",
    element: null,
    title: "That's the tour.",
    description:
      "Fills are honest, not fantasy. Every position gets measured against the index, not just your memory of how you did. And because you wrote down why, Krix can keep grading whether your reasoning held up - not just whether you made money. Go trade for real.",
    kind: "info",
  },
];

// How long journal-critique waits for a real critique before giving up and
// advancing with honest "still working on it" copy instead - see
// components/tour/GuidedTour.tsx. Padded above the worst case actually
// measured (two 429 retries at ~9s each, app/api/journal/critique/route.ts)
// without holding up the rest of a ~3.5-minute tour indefinitely.
export const CRITIQUE_BEAT_TIMEOUT_MS = 25_000;

// Forward-only: real state can push the persisted index ahead of itself
// (someone went off-script and already traded past where the tour thinks
// they are), never pull it back. Phases with no entry here have no
// independent signal to reconcile against - beats 0-4 are pure navigation
// with nothing in the database to check them against, so nothing forces
// them; only phases that mean a real trade-lifecycle event happened do.
// Indices shifted down by two when the modal-anchored fill beats were merged
// away. Keep these in step with TOUR_BEATS - a stale value here silently
// skips beats or strands the tour on one it can't advance past.
const PHASE_MIN_INDEX: Partial<Record<TourPhase, number>> = {
  holding_open: 5, // bought - at least at the portfolio beat
  closed_awaiting_critique: 7, // sold, position closed - at least at the journal beat
  critique_ready: 8, // critique landed - at least at the scorecard beat
};

export function reconcileStepIndex(persistedIndex: number, phase: TourPhase): number {
  const minIndex = PHASE_MIN_INDEX[phase];
  if (minIndex === undefined) return persistedIndex;
  return Math.max(persistedIndex, minIndex);
}
