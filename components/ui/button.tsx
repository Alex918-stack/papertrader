import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "buy" | "sell";
export type ButtonSize = "md" | "sm";

// One press-feedback depth, one radius, one transition timing - see DESIGN.md.
// Not every button in the app uses this component yet (adopted incrementally
// as each surface is touched, not a big-bang migration) - buttonVariants is
// exported separately so a styled `<Link>` (a "Go to Trading" CTA, say) can
// match without wrapping a real <button>.
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 ease-out-quart active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-coral-500 text-white hover:bg-coral-600 disabled:bg-neutral-200 disabled:text-neutral-400",
  secondary: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:text-neutral-400",
  ghost: "bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:text-neutral-300",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-neutral-200 disabled:text-neutral-400",
  // Buy/sell are semantic, not decorative - green/red is reserved for this
  // and for gain/loss, nowhere else. See DESIGN.md.
  buy: "bg-green-600 text-white hover:bg-green-700 disabled:bg-neutral-200 disabled:text-neutral-400",
  sell: "bg-red-600 text-white hover:bg-red-700 disabled:bg-neutral-200 disabled:text-neutral-400",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-sm",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], fullWidth && "w-full", className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, className, ...props },
  ref
) {
  return <button ref={ref} className={buttonVariants({ variant, size, fullWidth, className })} {...props} />;
});

export default Button;
