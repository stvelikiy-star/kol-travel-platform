"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type CatalogSection = "stays" | "tours" | "food" | "shop";

export function HomeSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<CatalogSection>("stays");

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    router.push(`/${section}${suffix}`);
  }

  return (
    <form className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]" onSubmit={submitSearch}>
      <Input aria-label="Поиск по каталогу" onChange={(event) => setQuery(event.target.value)} placeholder="Что ищем на Иссык-Куле?" value={query} />
      <Select aria-label="Раздел каталога" onChange={(event) => setSection(event.target.value as CatalogSection)} value={section}>
        <option value="stays">Жильё</option>
        <option value="tours">Туры</option>
        <option value="food">Еда</option>
        <option value="shop">Магазин</option>
      </Select>
      <Button className="w-full md:w-auto" type="submit">Найти</Button>
    </form>
  );
}
