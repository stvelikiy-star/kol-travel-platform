import { cn } from "@/lib/cn";

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
};

export function SectionTitle({ eyebrow, title, description, className }: SectionTitleProps) {
  return (
    <div className={cn("max-w-3xl space-y-3", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl font-semibold leading-[1.12] tracking-[-0.02em] text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? <p className="text-base leading-7 text-muted sm:text-lg">{description}</p> : null}
    </div>
  );
}
