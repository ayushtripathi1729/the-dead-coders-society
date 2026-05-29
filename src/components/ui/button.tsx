import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ className, asChild, variant = "primary", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const safeProps = asChild ? props : { type: "button" as const, ...props };
  return (
    <Comp
      className={cn(
        "electric-border clip-arena inline-flex h-12 items-center justify-center gap-2 px-5 font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.24em] transition duration-300 disabled:cursor-not-allowed disabled:opacity-50",
        "before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(110deg,rgba(255,255,255,.18),transparent_32%,rgba(255,255,255,.07))] before:opacity-50",
        variant === "primary" && "relative border border-[#9AFF00]/70 bg-black text-[#9AFF00] toxic-glow hover:bg-[#9AFF00] hover:text-black hover:tracking-[0.3em]",
        variant === "ghost" && "relative border border-[#8E2BFF]/70 bg-black/70 text-zinc-100 purple-glow hover:border-[#9AFF00]/80 hover:text-[#9AFF00] hover:tracking-[0.3em]",
        variant === "danger" && "relative border border-red-400/60 bg-red-500/10 text-red-100 hover:bg-red-500/20",
        className,
      )}
      {...safeProps}
    />
  );
}
