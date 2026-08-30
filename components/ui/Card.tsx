import { HTMLAttributes } from "react";
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
  // Matches the one documented hover-elevation step (shadow-sm -> shadow-md)
  // for cards that act as click targets, e.g. PortfolioSnapshot's tile.
  interactive?: boolean;
}

export default function Card({
  padding = "default",
  interactive,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-neutral-200 rounded-lg shadow-sm",
        PADDING_CLASSES[padding],
        interactive && "hover:border-coral-300 hover:shadow-md transition-all cursor-pointer",
        className
      )}
      {...props}
    />
  );
}
