import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "min-h-28 w-full min-w-0 resize-y rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground shadow-sm outline-none transition placeholder:text-muted/75 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-background disabled:opacity-60 sm:text-sm",
      className
    )}
    ref={ref}
    {...props}
  />
));

Textarea.displayName = "Textarea";
