import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-xl border border-ink-900/12 bg-white px-4 text-[15px] text-ink-900 placeholder:text-ink-400 transition focus:border-sage-400 focus:outline-none focus:ring-4 focus:ring-sage-200/60 disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-xl border border-ink-900/12 bg-white px-4 py-3 text-[15px] text-ink-900 placeholder:text-ink-400 transition focus:border-sage-400 focus:outline-none focus:ring-4 focus:ring-sage-200/60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold text-ink-800", className)} {...props} />;
}
