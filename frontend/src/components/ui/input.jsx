import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border border-input/60 bg-input/40 backdrop-blur-md px-4 py-3 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 placeholder:transition-all placeholder:duration-300 focus-visible:placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:bg-input/60 focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2),inset_0_2px_8px_rgba(0,0,0,0.2)] focus-visible:scale-[1.01] transition-all duration-300 hover:bg-input/55 hover:border-primary/30 hover:shadow-[inset_0_2px_10px_rgba(0,0,0,0.25),0_2px_8px_rgba(0,0,0,0.1)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm shadow-[inset_0_2px_8px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.1)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
