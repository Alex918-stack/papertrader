# Design tokens

Short reference, not a new system: this documents the scale that was already
mostly in use before this pass, plus the handful of drift fixes made while
writing it down. Source of truth for values is `app/globals.css`'s `@theme`
block; this file maps UI roles onto those values.

Two modes, two different scales. Operate = the actual product (dashboard,
trading, portfolio, journal, settings, stock detail). Persuade =
`components/marketing/*`, the public landing page. Don't cross-pollinate:
Operate's `text-sm` body copy has no business in a hero, and Persuade's
`text-5xl` has no business in a card title.

## Type scale (Operate)

| Role | Class |
|---|---|
| Meta / labels / timestamps / badges | `text-xs` |
| Body / UI text / form inputs / table cells | `text-sm` |
| Card / section title | `text-lg` |
| Page title (in `PageHeroHeader`) | `text-xl` / `text-2xl` |
| Key metric (portfolio value, price) | `text-2xl` |

Never go below `text-xs` (12px) for real content - two spots did
(`text-[9px]`, `text-[10px]`) and got fixed to `text-xs` in this pass.
`.num` (tabular figures, `font-geist-mono`) layers on top of size for any
price/total/measurement value, regardless of which size role applies.

## Type scale (Persuade - marketing only)

`text-3xl` through `text-6xl` for headlines, `text-base`/`text-lg` for
supporting copy. Lives entirely in `components/marketing/*`.

## Spacing

No custom scale - stock Tailwind (4px increments), followed closely.
Two padding tiers by role, not by size:

| Role | Class |
|---|---|
| List / dashboard card | `p-4` |
| Modal, detail panel, empty state | `p-6` |

Gaps: `gap-2` (inline/tight), `gap-3` (related items), `gap-4` (section
groups), `gap-6` (page-level sections). Controls: `px-3 py-2` for inputs and
menu items, `px-4 py-2` for buttons.

## Radius

One base token (`--radius` in `globals.css`), everything else derives from
it via `calc()` - tightening the base rescales the whole app proportionally.

| Role | Class |
|---|---|
| Controls: inputs, dropdown/menu panels, small buttons | `rounded-md` |
| Cards, modals | `rounded-lg` |
| Hero/banner surfaces (`PageHeroHeader`, marketing hero) | `rounded-2xl` / `rounded-3xl` |
| Pills: badges, chips, avatars, marketing CTAs | `rounded-full` |

`rounded-full` means pill/badge/marketing CTA - never a plain in-app button.
(`HoldingsTable`'s empty-state CTA used to break this; fixed to `rounded-md`
in this pass.)

## Elevation

| Role | Class |
|---|---|
| Resting card (default) | `shadow-sm` |
| Hover-elevated card (clickable tile) | `shadow-md` |
| Floating menu / dropdown | `shadow-lg` |
| Modal | `shadow-xl` |

Marketing's `shadow-lg shadow-coral-500/20` (colored glow on primary CTAs)
is a deliberate, separate Persuade-mode device - not part of this scale.

## Press feedback

`active:scale-[0.97]` on every interactive element, app-wide, marketing
included. One app, one press depth. (Was split 0.97/0.98 before Step 1.)

**One documented exception: icon-only buttons get `active:scale-[0.9]`,
not `0.97`.** A 3% scale change on a ~16-18px icon is a sub-pixel
difference - imperceptible, so it reads as no feedback at all on exactly
the controls (close ×, delete, panel toggles) where a mis-click matters
most. This was already the accidental pattern in two places (`NewsModal`'s
close ×, `ChatHistoryPanel`'s collapsed "New chat") before it was written
down here; Phase 2 made it a stated rule and applied it everywhere else an
icon-only button exists: `ToastProvider`'s dismiss ×, `ChatHistoryPanel`'s
expand/collapse toggles and delete-conversation, `Navbar`'s sidebar toggle
and avatar menu trigger. Any button whose content is icon-only (no visible
text label) follows this rule instead of the default 0.97 - it is a
*different control class*, not a missed spot.

Also **not** an exception, and deliberately unchanged: dropdown/panel
*trigger* buttons with a text label (symbol pickers, the "Select a stock"
button) and list-navigation rows inside open menus (search results,
symbol-picker options, Navbar's "Sign out"). These have no press feedback
at all, which is correct - they're frequent, toggle/navigation actions,
not commits, and the frequency table says reduce or remove animation on
anything clicked tens of times a session. This is a separate axis from the
icon-only exception above (size vs. frequency) - don't conflate the two
when extending either rule to a new component.

## Empty states

One composition, used for every "nothing here yet" screen (Journal,
Portfolio, Trade History, the new-account Dashboard card): `Card` (padding
`detail`), centered content, single CTA. Two tiers by how much explaining
the screen needs:

- **Persuasive** (Journal, Dashboard's new-account card) - icon badge +
  headline + one short body paragraph + one CTA. Reserved for screens where
  the user might not know *why* they'd want to fill it in.
- **Plain** (Portfolio, Trade History) - one sentence saying what will
  appear + one CTA. No icon, no headline. These don't need selling, just
  pointing.

Icon badge sizing: `w-9 h-9` inline in a row (journal stat bar, portfolio
snapshot tiles), `w-11 h-11` centered as a standalone visual (empty-state
headers). Always `rounded-full bg-coral-50 text-coral-600`.

An empty state never says what's missing ("No trades yet") - it says what
will show up and how to make that happen. Never apologetic, never styled
like an error (that tone is reserved for actual failures, e.g. benchmark's
`unavailable` status, which is left alone).

## Page composition (Dashboard, and the pattern to reuse in Step 4)

Group by what the content is about, don't stack in build order. The
Dashboard groups into the three zones its own subtitle names ("your
portfolio, the market, and the latest news"): portfolio snapshot + chart +
benchmark first, market quotes second, movers/watchlist/news last. No
per-zone visual treatment (no colored headers, no differentiated card
styling) - grouping and order alone carry the hierarchy.

**Collapsing row pattern:** when a row pairs a component that can be empty
(a chart with no data yet) with one that can't (benchmark), don't let the
empty one leave a gap - collapse the row to the non-empty component at full
width instead. `components/dashboard/PortfolioOverviewRow.tsx` is the
reference implementation. The page shouldn't change shape depending on
account age; it should change *contents*.

**Marketing hygiene, checked and confirmed clean:** no em-dashes anywhere
in `components/marketing/*` (design-taste-frontend's one non-negotiable
rule for that surface). The `glass-panel` floating cards in `Hero.tsx`
passed the "is the blur over real content" test (verified visually - they
sit over `ocean-gradient-hero` and the animated wave SVGs, not a flat
background) and stay as the one deliberate Persuade-mode accent.

## Shared primitives

`components/ui/Button.tsx` and `components/ui/Card.tsx` encode the tables
above so the values live in one place instead of being retyped per
component. They are **not** a big-bang migration - adopt them incrementally
as each surface gets touched in Steps 2-4, not as a batch rewrite of
existing working code.

- `Button`: `variant` (`primary` / `secondary` / `ghost` / `danger` / `buy`
  / `sell`), `size` (`md` / `sm`), `fullWidth`. `buttonVariants()` is
  exported separately for a `<Link>` styled as a button (e.g. an
  empty-state CTA). `buy`/`sell` are semantic color, not decoration - green
  and red are reserved for these plus gain/loss, nowhere else in the app.
- `Card`: `padding` (`default` = `p-4` / `detail` = `p-6`), `interactive`
  (adds the hover-elevation step for clickable tiles).

These are deliberately not a restore of the deleted `components/ui/button.tsx`
/ `card.tsx` - those were shadcn scaffolding wired to shadcn's own tokens
and were never actually adopted anywhere in the app.

**Adopted so far:**
- Step 2 (empty states): `WelcomeCard`, the Journal empty state,
  `HoldingsTable`'s and `TradeHistory`'s empty states, `BenchmarkComparison`
  (all four status branches).
- Step 4 phase 1 (Trading, Journal, Portfolio, Settings, Stock Detail):
  `OrderTicket`, `OrderConfirmModal`, `TradeHistory` (populated state),
  `StockChart`, `PortfolioChart`, `JournalEpisodeCard`, the journal stat
  bar, `PerformanceCard`, `HoldingsTable` (populated state), both Settings
  cards and all five of its buttons, `StockDetail`'s quote card and Trade
  button. `OrderTicket`'s Preview button and `OrderConfirmModal`'s Confirm
  button are the first real uses of the `buy`/`sell` variants.

Everywhere else still hand-rolls the equivalent className, per the
incremental-adoption rule above - convert as each surface is next touched,
not in a batch.

## Insufficient-history states, unified

`BenchmarkComparison`, `PortfolioChart`, and `StockChart` each have a "not
enough data yet" state. All three now use the same treatment: a `Clock`
icon next to the message, `text-neutral-500` (not the `text-neutral-400`
muted/error tone), no `Card` special-casing beyond the standard wrapper.
Copy differs per surface (untouched) - only the visual language is shared.
Not extracted into a component; three two-line occurrences don't clear the
bar for an abstraction.

## Journal: open/closed grouping

Episodes split into "Open" and "Closed" groups (open first - more
actionable) instead of one flat list, using the same small-label pattern
`TopMovers` already established for "Top Gainers"/"Top Losers"
(`text-xs text-neutral-400 mb-2`). A group only renders if it has at least
one episode. This is the one place in Step 4 phase 1 that added visual
structure rather than just adopting primitives - Journal was called out
specifically for more attention than a consistency pass.

## `setState`-in-effect: the render-time-adjustment pattern, second use

`ChatWindow.tsx` had two of these (`isSlow`/loading-label reset, and
`displayedContent` syncing to the `messages` prop). Both fixed the same way
`OrderTicket`'s `resetKey` was fixed: track the previous value, compare
during render, adjust state synchronously in the render body rather than in
an effect - not by wrapping the `setState` call in an async function, which
only defers the problem past the linter without solving it. The
`displayedContent` fix was itself removed in Step 4 phase 2 when
`revealGradually` was deleted entirely (see below) - the state it was
syncing no longer exists, so there's nothing left to adjust. The `isSlow`
fix stands; it has nothing to do with the reveal animation.

## Chat replies: `revealGradually` deleted, not fixed

The word-by-word "typing" reveal in `ChatWindow.tsx` was already
non-functional before Step 4 phase 2 touched it - verified live
(screenshots at 400/800/1200ms after sending) that the full reply appears
in one jump, never incrementally. Root cause: `/api/chat/route.ts` runs a
tool-calling loop up to 6 rounds deep, and only the *final* round (once
Gemini stops calling functions) produces reply text - the `useEffect` on
`messages` was overwriting the "" placeholder with that full text before
the `setInterval` driving the reveal ever got a tick in.

Deleted rather than fixed, because simulated progress over a response
that's already fully arrived is decoration pretending to be feedback -
exactly what this motion pass exists to remove, not add back. Replies now
render the instant they land. `displayedContent` state is gone entirely;
`MessageBubble` reads `message.content` directly.

**For whoever picks up real streaming later:** the 30-60s worst case this
feature was meant to help with is dominated by the tool-calling rounds
(`get_company_fundamentals`, `get_earnings_history`, etc. - the system
prompt explicitly asks for multi-tool "analyst-style" answers), not the
final text-generation round. Token streaming via `streamGenerateContent`
would only illuminate that last round - it helps least exactly where the
30-60s pain actually is, and helps most on fast single-round lookups that
rarely reach the "Still working..." threshold at all. Real streaming is
still worth doing eventually, but expect it to improve perceived latency on
quick answers, not fix the deep-research case - and budget for it
accordingly: SSE parsing that distinguishes function-call parts from text
parts mid-stream, a route response contract that streams instead of
returning one JSON object, a client rewrite of the fetch/JSON consumption,
a redesign of how `proposedTrades` rides alongside streamed text without
corrupting either, and retry/error handling for a failure after tokens are
already on screen (today's retry logic assumes a clean, all-or-nothing
request). That's backend and client work, not a motion-pass change.

## Numbers that change

`useAnimatedNumber` tweens a value instead of snapping - already used in 6
places before Step 4 phase 2 (`StockDetail`, `PerformanceCard`,
`OrderTicket`, `BenchmarkComparison`, `PortfolioSnapshot`,
`MarketOverview`). Quotes in this app fetch once per mount/symbol-change,
not on a live poll, so "changing numbers" really means two discrete
moments: switching stocks, and executing a trade - not a ticking price.

Extended to `HoldingsTable`'s Market Value and Gain/Loss columns in Step 4
phase 2 - they recompute at the same "trade just executed" moment that
already animates in `PerformanceCard`/`PortfolioSnapshot`/
`BenchmarkComparison`, so leaving them snapping was an inconsistency, not a
different case.

**Left alone on purpose:** `MarketOverview`'s existing usage never actually
animates in practice - its tiles only mount once a quote has already
arrived, so there's no "from" value to tween from. Not wrong, just inert;
fixing it means adding live polling, a data-layer change outside a motion
pass. `TradeHistory` (immutable historical rows), `WatchlistCard`, and
`TopMovers` (re-sorts on data change - an animating number would fight a
reordering row) are correctly excluded, not overlooked.

## Exit transitions: modals and toasts

Both animated in already (`.modal-enter`, `.message-enter`) but vanished
instantly on close - a conditional `return null` / array-filter unmount
with zero exit transition, the "elements disappearing without transition
feel broken" case. Fixed in plain CSS, not Motion (`motion/react`) - these
files had zero Motion usage before this, and the project already has a
working all-CSS animation system. `useDelayedUnmount` (`hooks/`) keeps a
closing element mounted for the exit duration while toggling
`data-state="closing"`, which `modal-out`/`overlay-out`/`toast-out`
keyframes key off - the same `data-mounted`-style fallback pattern
`emil-design-eng` names as the correct approach when not using
`@starting-style`. Exit is faster than entry and uses no spring/bounce
(~150ms `ease-out` vs. entry's 250ms `ease-spring`) - "release should
always be snappy" applies to closing a modal same as releasing a button.

Wired into `OrderConfirmModal`, `TradePlanThesisModal`, `NewsModal`, and
`ToastProvider`.

**Deliberately not touched:** dropdown/menu open-close (Navbar's user
menu, symbol pickers) and page-to-page navigation stay instant - both are
frequent-per-session actions, and the frequency table says reduce or
remove animation there, not add it. Also considered animating `WelcomeCard`'s
disappearance after a first trade; skipped - it's a genuine one-time-ever
moment per account, and building real enter/exit choreography for
something a user sees exactly once didn't clear the bar for this pass.

## Loading states: one skeleton treatment

`Skeleton`'s shimmer was already the dominant pattern (`MarketOverview`,
`PortfolioSnapshot`, `PerformanceCard`, `HoldingsTable`, `TradeHistory`,
`WatchlistCard`, Journal) before Step 4 phase 2 - the actual inconsistency
was `TopMovers`, `NewsWidget`, `StockChart`, and `PortfolioChart` still
showing plain "Loading..." text with no shape. Fixed by giving each a
`Skeleton` shaped like its own final content (row-shaped for
`TopMovers`/`NewsWidget`, chart-area-shaped for the two chart components).
`ChatWindow`'s "Thinking..." bubble stays as-is on purpose - a shimmer bar
doesn't map to a conversational reply's shape, so unifying it would be
wrong, not consistent.

## Checked and left alone: `transition-all`

Appears on nearly every button in the app, including the `Button`
primitive - technically against the "specify exact properties" rule, but
in every instance the properties actually changing (background-color,
transform, border-color, box-shadow) are paint-only, never
layout-triggering, so there's no real performance cost. Rewriting 40+
files for zero measurable benefit is churn, not restraint - left alone.
