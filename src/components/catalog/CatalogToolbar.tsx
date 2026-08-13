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
  className?: string;
};

export function CatalogToolbar({
  searchPlaceholder = "Поиск",
  locationOptions,
  categoryLabel,
  categoryOptions,
  sortOptions,
  resultCount,
  className
}: CatalogToolbarProps) {
  return (
    <div className={cn("rounded-lg border border-border/90 bg-surface/90 p-4 shadow-card backdrop-blur sm:p-5", className)}>
      <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold">
          Найдено: <span className="text-primary">{resultCount}</span>
        </p>
        <Button className="w-full sm:w-auto" variant="ghost">Сбросить фильтры</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
        <Input placeholder={searchPlaceholder} />
        <Select defaultValue="all">
          <option value="all">Локация</option>
          {locationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select defaultValue="all">
          <option value="all">{categoryLabel}</option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select defaultValue={sortOptions[0]?.value}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button className="w-full xl:w-auto">Найти</Button>
      </div>
    </div>
  );
}
