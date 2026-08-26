import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

type CatalogOption = {
  label: string;
  value: string;
};

type CatalogToolbarProps = {
  searchPlaceholder?: string;
  locationOptions: CatalogOption[];
  categoryLabel: string;
  categoryOptions: CatalogOption[];
  sortOptions: CatalogOption[];
  resultCount: number;
  resetHref: string;
  values?: {
    q?: string;
    location?: string;
    category?: string;
    sort?: string;
  };
  className?: string;
};

export function CatalogToolbar({
  searchPlaceholder = "Поиск",
  locationOptions,
  categoryLabel,
  categoryOptions,
  sortOptions,
  resultCount,
  resetHref,
  values = {},
  className
}: CatalogToolbarProps) {
  const defaultSort = values.sort || sortOptions[0]?.value || "default";

  return (
    <form
      className={cn("rounded-lg border border-border/90 bg-surface/90 p-4 shadow-card backdrop-blur sm:p-5", className)}
      method="get"
    >
      <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold" aria-live="polite">
          Найдено: <span className="text-primary">{resultCount}</span>
        </p>
        <Link
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background hover:text-primary sm:w-auto"
          href={resetHref}
        >
          Сбросить фильтры
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
        <Input defaultValue={values.q ?? ""} name="q" placeholder={searchPlaceholder} />
        <Select defaultValue={values.location || "all"} name="location">
          <option value="all">Локация</option>
          {locationOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
        <Select defaultValue={values.category || "all"} name="category">
          <option value="all">{categoryLabel}</option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
        <Select defaultValue={defaultSort} name="sort">
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
        <Button className="w-full xl:w-auto" type="submit">Найти</Button>
      </div>
    </form>
  );
}
