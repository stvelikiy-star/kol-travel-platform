import Link from "next/link";
import { cn } from "@/lib/cn";

export function CartLink({ className }: { className?: string }) {
  return <Link className={cn("inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary", className)} href="/cart">Корзина</Link>;
}
