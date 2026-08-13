"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  href?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  href = "#",
  onAction
}: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-surface/90">
      <CardContent className="flex min-h-64 flex-col items-stretch justify-center gap-4 p-5 sm:items-start sm:p-8">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="max-w-xl text-sm leading-6 text-muted">{description}</p>
        </div>
        {onAction ? (
          <Button onClick={onAction}>{actionLabel}</Button>
        ) : (
          <a
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)] sm:w-auto"
            href={href}
          >
            {actionLabel}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
