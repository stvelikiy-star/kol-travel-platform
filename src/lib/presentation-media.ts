import type { FoodItem, Product, Stay, Tour } from "@/types";

const MEDIA = {
  lake: "https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Issyk-Kul%2C%20Kyrgyzstan.jpg",
  coast: "https://commons.wikimedia.org/wiki/Special:FilePath/Issyk%20Kul%20Lake%2C%20Issyk%20Kul%20region%2C%20Kyrgyzstan.jpg",
  canyon: "https://commons.wikimedia.org/wiki/Special:FilePath/Issyk-Kul%2C%20Kyrgyzstan%20%2842812827150%29.jpg",
  mountains: "https://commons.wikimedia.org/wiki/Special:FilePath/Issyk%20kul%20Lake%20mountains.jpg",
  food: "https://commons.wikimedia.org/wiki/Special:FilePath/%D0%91%D0%B5%D1%88%D0%B1%D0%B0%D1%80%D0%BC%D0%B0%D0%BA.jpg",
  felt: "https://commons.wikimedia.org/wiki/Special:FilePath/Felt%20toys%20in%20Kyrgyzstan.jpg"
} as const;

export const presentationMedia = MEDIA;

export function stayImage(stay: Stay) {
  if (stay.type === "cottage" || stay.type === "villa") return MEDIA.coast;
  if (stay.type === "yurt_camp") return MEDIA.mountains;
  return MEDIA.lake;
}

export function tourImage(tour: Tour) {
  const value = `${tour.title} ${tour.description}`.toLowerCase();
  if (value.includes("джип") || value.includes("панорам") || value.includes("каракол")) return MEDIA.canyon;
  return MEDIA.mountains;
}

export function foodImage(_food: FoodItem) {
  return MEDIA.food;
}

export function productImage(_product: Product) {
  return MEDIA.felt;
}
