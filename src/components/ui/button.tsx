import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-sage-600 text-white shadow-soft hover:bg-sage-700",
        terra: "bg-terra-400 text-white shadow-soft hover:bg-terra-500",
        gold: "bg-gold-300 text-ink-900 shadow-soft hover:bg-gold-400",
        outline: "border border-ink-900/12 bg-white/70 text-ink-800 hover:bg-white hover:border-ink-900/20",
        ghost: "text-ink-700 hover:bg-ink-900/5",
        soft: "bg-sage-100 text-sage-800 hover:bg-sage-200",
        danger: "bg-[#c2452d] text-white hover:bg-[#a63a25]",
        link: "text-sage-700 underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-9 px-4 text-sm [&_svg]:size-4",
        default: "h-11 px-5 text-sm [&_svg]:size-4",
        lg: "h-13 px-7 text-base [&_svg]:size-5",
        xl: "h-16 px-8 text-lg [&_svg]:size-6",
        icon: "size-10 [&_svg]:size-5",
        iconLg: "size-16 [&_svg]:size-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";
export { buttonVariants };
