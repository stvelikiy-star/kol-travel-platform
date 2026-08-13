const alcoholKeywords = [
  "alcohol",
  "beer",
  "wine",
  "vodka",
  "whisky",
  "whiskey",
  "champagne",
  "cognac",
  "liquor",
  "спирт",
  "алкоголь",
  "пиво",
  "вино",
  "водка",
  "виски",
  "шампанское",
  "коньяк",
  "арак"
];

export function hasAlcoholKeyword(value: string) {
  const normalized = value.toLocaleLowerCase();
  return alcoholKeywords.some((keyword) => normalized.includes(keyword));
}

export function getCatalogSafetyFlags(input: {
  category?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  price?: number | null;
  status?: string | null;
  title?: string | null;
}) {
  const flags: string[] = [];
  const searchable = [
    input.title,
    input.description,
    input.category,
    input.metadata ? JSON.stringify(input.metadata) : ""
  ]
    .filter(Boolean)
    .join(" ");

  if (hasAlcoholKeyword(searchable)) {
    flags.push("alcohol_keyword_match");
  }

  if (!input.category) {
    flags.push("missing_category");
  }

  if (typeof input.price === "number" && input.price < 0) {
    flags.push("invalid_price");
  }

  if (!input.status || input.status === "unknown") {
    flags.push("invalid_status");
  }

  return flags;
}
