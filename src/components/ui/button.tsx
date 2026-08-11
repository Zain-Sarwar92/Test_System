import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[0.8rem] text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-brand to-brand-deep text-white shadow-[0_10px_24px_rgba(15,118,110,0.28)] hover:brightness-110 hover:shadow-[0_12px_28px_rgba(15,118,110,0.34)]",
        secondary:
          "bg-gradient-to-br from-white to-mist text-ink border border-[rgba(15,40,70,0.1)] hover:border-[rgba(15,118,110,0.28)]",
        outline:
          "border border-[rgba(15,40,70,0.14)] bg-white/70 text-ink-soft hover:bg-white hover:border-brand/40",
        ghost: "text-ink-soft hover:bg-white/70 hover:text-ink",
        danger:
          "bg-gradient-to-br from-[#d92d20] to-[#912018] text-white hover:brightness-110",
      },
      size: {
        default: "h-11 min-w-[7.5rem] px-4",
        sm: "h-9 min-w-[5.5rem] px-3 text-xs",
        lg: "h-12 min-w-[9rem] px-6 text-[0.95rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";
