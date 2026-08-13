import type { ReactNode } from "react";
import { SectionTitle } from "@/components/ui/SectionTitle";

type CatalogSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  isEmpty?: boolean;
};

export function CatalogSection({
  title,
  description,
  children,
  toolbar,
  emptyState,
  isEmpty = false
}: CatalogSectionProps) {
  return (
    <section className="space-y-8">
      <SectionTitle description={description} eyebrow="Каталог" title={title} />
      {toolbar}
      {isEmpty ? emptyState : children}
    </section>
  );
}
