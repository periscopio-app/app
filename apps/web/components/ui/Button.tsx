import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-6 text-base font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roxo focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-linha disabled:text-neutral-800";

const variants = {
  primary: "bg-roxo-100 border border-roxo text-black hover:bg-roxo-200",
  outline: "border-[1.5px] border-roxo bg-white text-black hover:bg-roxo-50",
  ghost: "px-5 text-black hover:bg-ceu-50",
  danger: "bg-[#FDECEA] border border-erro text-black hover:bg-[#F9D5D1]",
} as const;

export type ButtonVariant = keyof typeof variants;

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={cn(base, variants[variant], className)} {...props} />;
}
