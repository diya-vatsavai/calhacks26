import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3", {
  variants: {
    variant: {
      default: "bg-sage-100 text-sage-800",
      terra: "bg-terra-100 text-terra-600",
      gold: "bg-gold-100 text-gold-500",
      outline: "border border-ink-900/15 text-ink-700",
      muted: "bg-ink-900/5 text-ink-600",
      demo: "border border-dashed border-gold-400 bg-gold-100/60 text-gold-500",
      live: "bg-sage-600 text-white",
      danger: "bg-[#fbe3dd] text-[#a63a25]",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
