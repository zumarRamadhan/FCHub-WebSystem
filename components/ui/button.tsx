import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-semibold transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-forest-900 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-forest-900 text-white hover:bg-forest-900/90 rounded-pill",
        secondary: "bg-surface border border-line text-ink hover:bg-surface-muted rounded-pill",
        accentAction: "bg-lime-500 text-forest-900 hover:bg-lime-400 rounded-full shadow-sm",
        iconAction: "rounded-full bg-surface-muted hover:bg-line text-ink",
        danger: "bg-negative/10 text-negative hover:bg-negative/20 rounded-pill",
      },
      size: {
        default: "h-12 px-6 text-[14px]",
        sm: "h-9 px-4 text-[13px]",
        round64: "w-16 h-16 min-w-[64px] min-h-[64px] p-0",
        round36: "w-9 h-9 min-w-[36px] min-h-[36px] p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  arrowIcon?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, arrowIcon, children, ...props }, ref) => {
    // Tombol aksi bulat 64px khusus design.md
    if (variant === "accentAction") {
      return (
        <button
          ref={ref}
          className={cn(buttonVariants({ variant, size: "round64" }), className)}
          {...props}
        >
          {children || <ArrowUpRight className="w-7 h-7 stroke-[2]" />}
        </button>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
        {arrowIcon && <ArrowUpRight className="ml-1.5 w-4 h-4 stroke-[2]" />}
      </button>
    );
  }
);
Button.displayName = "Button";
