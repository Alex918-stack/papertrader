import { HTMLAttributes, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

// The two paddings actually in use, named by role rather than size - see
// DESIGN.md. "detail" covers modals and standalone detail/empty-state
// panels; everything else (list cards, dashboard tiles) is "default".
export type CardPadding = "default" | "detail";

const PADDING_CLASSES: Record<CardPadding, string> = {
  default: "p-4",
  detail: "p-6",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  // Adds the one documented hover-elevation step (shadow-sm -> shadow-md)
  // plus button semantics, for cards that are themselves the click target.
  //
  // Nothing passes this today. If you start using it, do NOT put focusable
  // children (buttons, links, inputs) inside an interactive Card: role="button"
  // around interactive content is invalid ARIA, and a keypress on the child
  // bubbles up and fires the card's onClick as well. A card containing its own
  // controls should stay non-interactive and let those controls be the targets.
  interactive?: boolean;
}

export default function Card({
  padding = "default",
  interactive,
  className,
  onClick,
  onKeyDown,
  onKeyUp,
  role,
  tabIndex,
  ...props
}: CardProps) {
  // Mirrors native <button> key semantics, which are asymmetric on purpose:
  //
  //   Enter -> activates on keydown
  //   Space -> scrolling suppressed on keydown, activation on keyup
  //
  // Space has to wait for keyup because a held key emits repeating keydown
  // events, so activating there fires onClick once per repeat - one long
  // Space press would trigger the card several times over.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) {
      onKeyDown?.(event);
      return;
    }

    // Give the caller's handler first refusal, so it can opt out of the
    // default activation by calling preventDefault itself.
    onKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.click();
    } else if (event.key === " " || event.key === "Spacebar") {
      // Suppress the page scroll only; activation is deferred to keyup.
      event.preventDefault();
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) {
      onKeyUp?.(event);
      return;
    }

    onKeyUp?.(event);
    if (event.defaultPrevented) {
      return;
    }

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  return (
    <div
      className={cn(
        "bg-white border border-neutral-200 rounded-lg shadow-sm",
        PADDING_CLASSES[padding],
        interactive &&
          "hover:border-coral-300 hover:shadow-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500 focus-visible:ring-offset-2",
        className
      )}
      {...props}
      role={interactive ? "button" : role}
      tabIndex={interactive ? 0 : tabIndex}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : onKeyDown}
      onKeyUp={interactive ? handleKeyUp : onKeyUp}
    />
  );
}
