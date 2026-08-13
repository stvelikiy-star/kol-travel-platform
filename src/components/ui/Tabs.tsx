import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full", className)} {...props} />;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex w-full gap-1 rounded-lg border border-border bg-surface p-1 sm:w-auto",
        className
      )}
      {...props}
    />
  );
}

type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function TabsTrigger({
  active = false,
  className,
  type = "button",
  ...props
}: TabsTriggerProps) {
  return (
    <button
      className={cn(
        "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition sm:flex-none",
        active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-background hover:text-foreground",
        className
      )}
      type={type}
      {...props}
    />
  );
}

type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function TabsContent({ className, ...props }: TabsContentProps) {
  return <div className={cn("mt-4", className)} {...props} />;
}
