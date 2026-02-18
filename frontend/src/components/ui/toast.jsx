import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva } from "class-variance-authority";
import { X, CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport asChild {...props}>
    <div
      ref={ref}
      className={cn(
        "pointer-events-none fixed top-4 right-4 z-[999] flex max-h-dscreen w-full max-w-sm flex-col gap-3",
        className,
      )}
    />
  </ToastPrimitives.Viewport>
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "pointer-events-auto relative w-full max-w-sm rounded-lg border shadow-lg p-4 transition-transform duration-300 ease-in-out will-change-transform will-change-opacity data-[state=open]:translate-y-0 data-[state=closed]:-translate-y-3 data-[state=open]:[animation:toast-enter_0.26s_cubic-bezier(0.2,0.8,0.4,1)_forwards] data-[state=closed]:[animation:toast-leave_0.2s_cubic-bezier(0.4,0,1,1)_forwards]",
  {
    variants: {
      variant: {
        default:
          "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-100 dark:border-green-800",
        destructive:
          "bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-100 dark:border-red-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const iconWrapVariants = cva(
  "relative flex h-6 w-6 items-center justify-center rounded-full",
  {
    variants: {
      variant: {
        default: "text-green-600 dark:text-green-200",
        destructive: "text-red-600 dark:text-red-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const iconGlowVariants = cva("absolute inset-0 rounded-full", {
  variants: {
    variant: {
      default: "bg-green-400/35 [animation:toast-glow_2.8s_ease-in-out_infinite]",
      destructive: "bg-red-400/35 [animation:toast-glow_2.8s_ease-in-out_infinite]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const Toast = React.forwardRef(({ className, variant, children, ...props }, ref) => (
  <ToastPrimitives.Root asChild {...props}>
    <div ref={ref} className={cn("toast-motion", toastVariants({ variant }), className)}>
      <div className="flex items-start gap-2.5">
        <span className="relative mt-0.5 flex items-center justify-center">
          <span className={cn(iconGlowVariants({ variant }), "toast-reduced-motion")} aria-hidden />
          <span className={cn(iconWrapVariants({ variant }))}>
            {variant === "destructive" ? (
              <XCircle className="h-4 w-4 text-inherit toast-reduced-motion [animation:toast-icon-scale_2.6s_ease-in-out_infinite]" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-inherit toast-reduced-motion [animation:toast-icon-scale_2.6s_ease-in-out_infinite]" />
            )}
          </span>
        </span>
        <div className="flex w-full flex-col gap-1 text-left">
          {children}
        </div>
      </div>
    </div>
  </ToastPrimitives.Root>
));
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-current/60 transition-colors hover:text-current focus:outline-none focus:ring-2 focus:ring-offset-2",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm text-current/80", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
