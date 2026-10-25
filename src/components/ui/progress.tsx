"use client";
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({ className, value, indicatorClassName, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root className={cn("relative h-2 w-full overflow-hidden rounded-full bg-ink-900/[0.07]", className)} {...props}>
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full bg-sage-500 transition-all duration-500", indicatorClassName)}
        style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
