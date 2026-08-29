"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type Lenis from "lenis";
import type { Driver, Config } from "driver.js";
import { useTour } from "@/components/tour/TourProvider";
import { TOUR_BEATS, CRITIQUE_BEAT_TIMEOUT_MS, TOUR_ENABLED } from "@/lib/tour";
import { waitForElement } from "@/lib/waitForElement";

// Data-fetch-driven anchors (a quote loading, a scorecard computing) get a
// bounded wait, then the tour skips forward rather than hanging - see
// lib/waitForElement.ts. Anchors that only exist after a real user action
// (the confirm modal opening) are handled separately below, with no forced
// timeout, because that wait is supposed to sit there until the user acts.
const ELEMENT_WAIT_TIMEOUT_MS = 6000;

// How long to tolerate pathname !== beat.page before concluding the user
// genuinely navigated away rather than a real navigation just being in
// flight. Covers goToBeat's own router.push, TourPrompt/Settings starting a
// fresh run from a different page, AND the reconciliation effect in
// useTourState.ts jumping stepIndex forward on a real phase change without
// ever calling router.push - all three look identical from here, and a
// real client-side transition resolves in well under this window.
const PAGE_MISMATCH_TIMEOUT_MS = 6000;

// A few pixels of breathing room above/below whatever we scroll to, so the
// target isn't jammed against the viewport edge.
const SCROLL_MARGIN_PX = 24;

interface GuidedTourProps {
  lenisRef: React.RefObject<Lenis | null>;
  mainRef: React.RefObject<HTMLElement | null>;
}

// Renders nothing itself - driver.js manages its own overlay DOM outside
// React's tree. Drives navigation itself: every beat either advances in
// place (same page, driver.js's own Next) or the last beat on a page
// pushes the route for the next one and this component picks the sequence
// back up once the new page's anchor exists. The user is never asked to
// go find the next page themselves.
export default function GuidedTour({ lenisRef, mainRef }: GuidedTourProps) {
  const tour = useTour();
  const pathname = usePathname();
  const router = useRouter();
  const activeDriverRef = useRef<Driver | null>(null);
  const shownIndexRef = useRef<number | null>(null);
  const criticalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      activeDriverRef.current?.destroy();
      if (criticalTimeoutRef.current) clearTimeout(criticalTimeoutRef.current);
    };
  }, []);

  // driver.js's overlay sits on top of the whole viewport with
  // pointer-events:auto (needed for overlayClickBehavior) everywhere
  // except the highlighted element - confirmed empirically, not assumed:
  // a wheel gesture over the highlighted card scrolls normally (Lenis's
  // own listener handles it), but the SAME gesture one pixel outside it -
  // sidebar, the rest of the page - moves nothing, even though driver.js's
  // own `allowScroll` config (which only toggles a body-overflow class) is
  // already true by default and isn't the thing blocking it. A beat whose
  // highlighted region or action target is taller than the viewport (see
  // the pre-beat scroll-into-view below) needs the user to be able to
  // scroll from ANYWHERE on the page, not just from on top of the one
  // element driver.js left interactive - so this forwards wheel input to
  // Lenis directly whenever it lands outside the real scroll container,
  // bypassing the dead zone instead of fighting driver.js's CSS for it.
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!activeDriverRef.current) return; // no popover open - nothing to route around
      const main = mainRef.current;
      if (!main || (e.target instanceof Node && main.contains(e.target))) return; // reached Lenis normally already
      e.preventDefault();
      const lenis = lenisRef.current;
      if (!lenis) return;
      lenis.scrollTo(lenis.animatedScroll + e.deltaY, { immediate: true });
    }
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called right before a beat's popover opens. If its anchor is taller
  // than the viewport, both ends can't be visible at once - prioritize the
  // bottom, since every current tall beat (the order ticket) puts its
  // actionable button last, not first.
  function ensureTargetVisible(target: Element) {
    // Check the element's OWN scrollability first, not DOM ancestry -
    // main.contains(target) is true for the confirm modal too (it's a
    // React child rendered inside main's subtree), even though its CSS
    // position:fixed means scrolling main's Lenis-tracked content would
    // never actually move it. An element managing its own overflow (see
    // OrderConfirmModal.tsx's max-h + overflow-y-auto safety net) needs
    // ITS scrollTop touched directly, plain native scroll, regardless of
    // where it lives in the tree.
    if (target.scrollHeight > target.clientHeight) {
      target.scrollTop = target.scrollHeight; // same bottom-first heuristic as below
      return;
    }
    const main = mainRef.current;
    const lenis = lenisRef.current;
    if (!main || !lenis || !main.contains(target)) return;
    const rect = target.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    // Real DOM scrollTop, not lenis.animatedScroll - driver.js's own
    // scrollIntoView() (called synchronously inside drive(), see above)
    // moves the actual DOM scroll position directly; Lenis only
    // re-syncs its internal animatedScroll from a native 'scroll'
    // event, which fires on a later tick, not within this same call
    // stack. Reading animatedScroll here would use a stale
    // pre-driver.js-scroll baseline.
    const elementTop = rect.top + main.scrollTop;
    if (rect.height > viewportHeight) {
      if (rect.bottom <= viewportHeight) return; // bottom already visible
      lenis.scrollTo(elementTop + rect.height - viewportHeight + SCROLL_MARGIN_PX, { immediate: true });
    } else if (rect.top < 0 || rect.bottom > viewportHeight) {
      lenis.scrollTo(elementTop - SCROLL_MARGIN_PX, { immediate: true });
    }
  }

  // A finished-then-replayed tour reuses this same long-lived component
  // instance (mounted once in AppShell) - without this, shownIndexRef
  // would still hold the last beat of the PREVIOUS run and silently block
  // beat 0 from ever showing again.
  useEffect(() => {
    if (tour.active) shownIndexRef.current = null;
  }, [tour.active]);

  // Returns false (and never calls driver.js at all) if config's element
  // selector doesn't actually resolve at drive-time. Every call site has
  // already checked existence moments earlier (waitForElement or an
  // indefinite poll) before calling this, but that's a check-then-act gap,
  // not a guarantee - driver.js itself doesn't fail on a missing element,
  // it just renders an unanchored, centered popover, which is a silent
  // dead end wearing a costume. Checked here too, explicitly, rather than
  // trusted to driver.js.
  async function openBeat(config: Config): Promise<boolean> {
    const stepElement = config.steps?.[0]?.element;
    if (typeof stepElement === "string" && !document.querySelector(stepElement)) {
      return false;
    }
    const [{ driver }] = await Promise.all([import("driver.js"), import("driver.js/dist/driver.css")]);
    // Re-check post-import: the dynamic import is an await, real time in
    // which the element can vanish (a navigation racing this exact call).
    if (typeof stepElement === "string" && !document.querySelector(stepElement)) {
      return false;
    }
    activeDriverRef.current?.destroy();
    const instance = driver({
      popoverClass: "tour-popover",
      // Driver.js's own default (clicking the dimmed backdrop) destroys
      // its instance directly without ever calling onCloseClick - React
      // state would stay stuck thinking the tour is still active and
      // showing this beat. Routed through the same skip() as the explicit
      // close button and skip link so all three dismissal paths agree.
      overlayClickBehavior: (_el, _step, opts) => {
        opts.driver.destroy();
        tour.skip();
      },
      onPopoverRender: (popover, opts) => {
        // The corner "x" is easy to miss - an explicit, always-visible
        // text link is the real skip affordance. Inserted FIRST, not
        // appended, so it lands to the left of driver.js's own progress
        // text + nav buttons - those two already fill the footer's
        // space-between layout, so appending a third child after them left
        // it crammed against the Next button with no gap.
        const skipLink = document.createElement("button");
        skipLink.type = "button";
        skipLink.textContent = "Skip tour";
        skipLink.className = "tour-skip-link";
        skipLink.onclick = () => {
          opts.driver.destroy();
          tour.skip();
        };
        popover.footer.insertBefore(skipLink, popover.footer.firstChild);
      },
      onCloseClick: (_el, _step, opts) => {
        opts.driver.destroy();
        tour.skip();
      },
      ...config,
    });
    activeDriverRef.current = instance;
    instance.drive();
    return true;
  }

  function goToBeat(index: number) {
    const nextBeat = TOUR_BEATS[index];
    if (!nextBeat) {
      tour.finish();
      return;
    }
    tour.advanceTo(index);
    if (nextBeat.page !== pathname) router.push(nextBeat.page);
    // Same-page case needs no extra push here - the effect below reacts
    // to tour.stepIndex changing on its own.
  }

  useEffect(() => {
    if (!TOUR_ENABLED) return; // parked - see lib/tour.ts
    if (!tour.active) return;
    const index = tour.stepIndex;
    const beat = TOUR_BEATS[index];
    if (!beat) return;

    // INVARIANT: a beat's popover must never render unless pathname
    // already equals beat.page. Enforced before anything else runs this
    // tick. A mismatch has three possible causes that all look identical
    // from here: goToBeat's own router.push still in flight, another
    // component (TourPrompt/Settings) having just started a fresh run from
    // a different page, or useTourState's reconciliation effect jumping
    // stepIndex forward on a real phase change - which never navigates at
    // all. Kill any stale popover from wherever we WERE immediately (its
    // anchor no longer exists on this page - waiting even a moment left an
    // unanchored popover floating over the wrong page's content), then
    // give real navigation a few seconds to land before concluding the
    // user genuinely wandered off under their own steam - back button and
    // driver.js's own backdrop-click both bypass its pointer-events lockout
    // entirely, so "the highlighted element is unclickable" never actually
    // prevented leaving. pause() rather than skip(): this isn't the user
    // choosing to end the tour, so the existing resume prompt should
    // re-offer, not treat it as dismissed for good.
    if (pathname !== beat.page) {
      if (activeDriverRef.current) {
        activeDriverRef.current.destroy();
        activeDriverRef.current = null;
      }
      shownIndexRef.current = null;
      const timeout = setTimeout(() => tour.pause(), PAGE_MISMATCH_TIMEOUT_MS);
      return () => clearTimeout(timeout);
    }

    if (shownIndexRef.current === index) return; // already displaying/displayed this exact beat
    shownIndexRef.current = index;

    let cancelled = false;
    const progressText = `Step ${index + 1} of ${TOUR_BEATS.length}`;

    async function show() {
      const selector = beat.resolveElement
        ? beat.resolveElement({ closedEpisodeId: tour.closedEpisodeId })
        : beat.element;

      // Doing beat whose own anchor already exists (the thesis form, the
      // action selector) but that still must not be click-advanceable -
      // clicking Next would dismiss the instruction without the user
      // having done it, then strand them on a page with nothing telling
      // them what to do next. No button; the popover sits on its own
      // element and waits - indefinitely, same as any other doing beat -
      // for advanceWhen to appear, then advances itself.
      if (beat.advanceWhen) {
        const result = selector ? await waitForElement(selector, ELEMENT_WAIT_TIMEOUT_MS) : { found: false };
        if (cancelled) return;
        if (!result.found || !selector) {
          goToBeat(index + 1); // this beat's own anchor never showed up either
          return;
        }
        // Manual escape hatch. Auto-advance alone stranded users here four
        // separate times; a tour with no way forward is far worse than one
        // that lets you move on without performing the action. The poll
        // below still advances automatically when the action really
        // happens - this just guarantees there is always a button.
        let manuallyAdvanced = false;
        const opened = await openBeat({
          showProgress: true,
          progressText,
          steps: [
            {
              element: selector,
              popover: {
                title: beat.title,
                description: beat.description,
                showButtons: ["next", "close"],
                nextBtnText: "Next",
                onNextClick: (_el, _s, opts) => {
                  manuallyAdvanced = true;
                  opts.driver.destroy();
                  goToBeat(index + 1);
                },
              },
            },
          ],
        });
        if (cancelled) return;
        if (!opened) {
          goToBeat(index + 1); // vanished between the check above and drive() itself
          return;
        }
        // AFTER drive(), not before - driver.js does its own
        // scrollIntoView({block:'start'}) synchronously inside drive(),
        // via the real DOM scrollTop, bypassing Lenis's tracked position
        // entirely. Calling this first just gets silently overwritten.
        const el = document.querySelector(selector);
        if (el) ensureTargetVisible(el);
        while (!cancelled && !manuallyAdvanced) {
          if (document.querySelector(beat.advanceWhen)) break;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        if (cancelled || manuallyAdvanced) return;
        goToBeat(index + 1);
        return;
      }

      // Waits on a real user action (Preview opening the confirm modal),
      // not a data fetch - deliberately no timeout. Giving up here would
      // mean silently skipping the exact moment - honest fills - the tour
      // exists to show.
      if (beat.kind === "doing" && !beat.resolveElement) {
        // Short, not generous. In the normal flow the previous beat
        // auto-advances here the moment this anchor appears, so it's
        // already present on arrival and this resolves instantly. The only
        // way to get here without it is a manual skip - in which case the
        // action is never coming, and waiting means an invisible tour with
        // no popover and nothing to click. Move on fast instead.
        const DOING_ACTION_TIMEOUT_MS = 5000;
        const deadline = Date.now() + DOING_ACTION_TIMEOUT_MS;
        while (!cancelled) {
          if (selector && document.querySelector(selector)) break;
          if (Date.now() > deadline) {
            goToBeat(index + 1); // action never came - move on rather than hang
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        if (cancelled || !selector) return;
        // If this returns false, the anchor vanished right as we tried to
        // show it (almost certainly the pathname-mismatch branch above is
        // about to fire on the next render) - nothing else to do here.
        await openBeat({
          showProgress: true,
          progressText,
          steps: [
            {
              element: selector,
              popover: {
                title: beat.title,
                description: beat.description,
                showButtons: ["next", "close"],
                nextBtnText: "Next",
                onNextClick: (_el, _s, opts) => {
                  opts.driver.destroy();
                  goToBeat(index + 1);
                },
              },
            },
          ],
        });
        // AFTER drive() - see the advanceWhen branch above for why.
        const doingEl = document.querySelector(selector);
        if (doingEl) ensureTargetVisible(doingEl);
        return;
      }

      // journal-critique: the episode card itself is a normal bounded
      // wait, but the critique TEXT inside it is a separate, async,
      // possibly-failing wait (Gemini) - see the timeout below.
      if (beat.id === "journal-critique") {
        const result = selector ? await waitForElement(selector, ELEMENT_WAIT_TIMEOUT_MS) : { found: false };
        if (cancelled) return;
        if (!result.found || !selector) {
          goToBeat(index + 1); // no episode to point at - never a silent dead end
          return;
        }
        const opened = await openBeat({
          showProgress: true,
          progressText,
          steps: [{ element: selector, popover: { title: beat.title, description: beat.description, showButtons: ["close"] } }],
        });
        if (cancelled) return;
        if (!opened) {
          goToBeat(index + 1);
          return;
        }
        // AFTER drive() - see the advanceWhen branch above for why.
        const critiqueEl = document.querySelector(selector);
        if (critiqueEl) ensureTargetVisible(critiqueEl);
        criticalTimeoutRef.current = setTimeout(() => {
          if (shownIndexRef.current !== index) return; // the real critique already landed and moved us on
          openBeat({
            showProgress: true,
            progressText,
            steps: [
              {
                element: selector,
                popover: {
                  title: "Still writing",
                  description:
                    "Krix is still working on this one - it'll be in your journal shortly. No need to wait here.",
                  showButtons: ["next", "close"],
                  // Every beat is its own single-step driver() session, so
                  // driver.js's hasNextStep() is always false and it
                  // defaults this button's label to "Done" regardless of
                  // position - explicit override, same fix as below.
                  nextBtnText: "Next",
                  onNextClick: (_el, _s, opts) => {
                    opts.driver.destroy();
                    goToBeat(index + 1);
                  },
                  onDoneClick: (_el, _s, opts) => {
                    opts.driver.destroy();
                    goToBeat(index + 1);
                  },
                },
              },
            ],
          });
        }, CRITIQUE_BEAT_TIMEOUT_MS);
        return;
      }

      // Every other beat: an ordinary navigation/info beat.
      const result = selector ? await waitForElement(selector, ELEMENT_WAIT_TIMEOUT_MS) : { found: true, element: null };
      if (cancelled) return;
      if (!result.found) {
        goToBeat(index + 1); // anchor never showed up - skip forward, don't hang
        return;
      }
      const isLast = index === TOUR_BEATS.length - 1;
      const onAdvance = (opts: { driver: Driver }) => {
        opts.driver.destroy();
        if (isLast) {
          tour.finish();
        } else {
          goToBeat(index + 1);
        }
      };
      const opened = await openBeat({
        showProgress: true,
        progressText,
        steps: [
          {
            element: selector ?? undefined,
            popover: {
              title: beat.title,
              description: beat.description,
              showButtons: ["next", "close"],
              // Every beat runs as its own single-step driver() session, so
              // driver.js's internal hasNextStep() is always false and it
              // silently falls back to doneBtnText ("Done") regardless of
              // this beat's real position in TOUR_BEATS - explicit label
              // per beat, not per driver.js session.
              nextBtnText: isLast ? "Done" : "Next",
              onNextClick: (_el, _s, opts) => onAdvance(opts),
              onDoneClick: (_el, _s, opts) => onAdvance(opts),
            },
          },
        ],
      });
      if (cancelled) return;
      if (!opened) {
        goToBeat(index + 1);
        return;
      }
      // AFTER drive() - see the advanceWhen branch above for why.
      if (selector) {
        const infoEl = document.querySelector(selector);
        if (infoEl) ensureTargetVisible(infoEl);
      }
    }

    show();

    return () => {
      cancelled = true;
      if (criticalTimeoutRef.current) {
        clearTimeout(criticalTimeoutRef.current);
        criticalTimeoutRef.current = null;
      }
    };
    // tour.finish/advanceTo/skip are stable (useCallback in useTourState) -
    // depending on the whole `tour` object instead of these primitives was
    // a real bug: useTourState/the debug wrapper return a NEW object every
    // render, so any unrelated re-render (portfolio/journal data settling
    // right after mount - normal on every page load) tore this effect down
    // mid-show(). shownIndexRef already marked the beat as shown, so the
    // retry was silently swallowed and the cancelled show() never called
    // openBeat - a real silent dead end, not just a debug-harness artifact.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.active, tour.stepIndex, tour.closedEpisodeId, pathname]);

  return null;
}
