import { redirect } from "next/navigation";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function FoodPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams({ tab: "food" });
  for (const key of ["q", "location", "category", "sort"]) {
    const value = valueOf(params[key]);
    if (value) query.set(key, value);
  }
  redirect(`/delivery?${query.toString()}`);
}
