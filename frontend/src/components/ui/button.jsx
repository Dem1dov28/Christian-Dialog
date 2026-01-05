import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        neomorphic: "relative bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[0_10px_30px_-10px_rgba(var(--primary),0.5),0_4px_12px_-2px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_40px_-8px_rgba(var(--primary),0.6),0_6px_16px_-4px_rgba(0,0,0,0.4)] hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-white/10 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        glass: "relative bg-card/40 backdrop-blur-xl border border-white/10 text-foreground hover:bg-card/60 hover:border-primary/30 hover:shadow-[0_8px_24px_-4px_rgba(var(--primary),0.2)] transition-all duration-300 before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
