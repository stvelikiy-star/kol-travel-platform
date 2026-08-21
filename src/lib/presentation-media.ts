import type { FoodItem, Product, Stay, Tour } from "@/types";

const commons = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;

const MEDIA = {
  lake: commons("Lake Issyk-Kul, Kyrgyzstan.jpg"),
  ambientLake: commons("Issyk-Kul, Kyrgyzstan (6019934565).jpg"),
  coast: commons("Issyk Kul Lake, Issyk Kul region, Kyrgyzstan.jpg"),
  coastBeach: commons("Issyk-Kul, Kyrgyzstan (43943254394).jpg"),
  lakeBlue: commons("Issyk-kul.jpg"),
  lakeSouth: commons("Issyk-Kul, Kyrgyzstan (42812885110).jpg"),
  lakeView: commons("Issyk-Kul, Kyrgyzstan (29685360547).jpg"),
  canyon: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg/960px-Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg",
  canyonWide: commons("Skazka Canyon, Kyrgyzstan (30754163968).jpg"),
  canyonWarm: commons("Skazka Canyon, Kyrgyzstan (44573302122).jpg"),
  mountains: commons("Issyk kul Lake mountains.jpg"),
  yurtCamp: commons("Yurta camp in the southern shore of Issyk-Kul.jpg"),
  yurt: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Kyrgyz_Yurt%2C_Kyrgyzstan.jpg/960px-Kyrgyz_Yurt%2C_Kyrgyzstan.jpg",
  beshbarmak: commons("Бешбармак.jpg"),
  beshbarmakAlt: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/E7870-Dordoy-laghman.jpg/960px-E7870-Dordoy-laghman.jpg",
  manty: commons("FOOD Mantu.jpg"),
  bazaar: commons("Osh Bazaar in Bishkek, Kyrgyzstan- dried fruits and nuts.jpg"),
  felt: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Felt_toys_in_Kyrgyzstan.jpg/960px-Felt_toys_in_Kyrgyzstan.jpg",
  feltMaking: commons("Needle-felt-making-1080204.jpg"),
  woolFelt: commons("Wool Felt making KG.jpeg")
} as const;

export const presentationMedia = MEDIA;

const stayById: Record<string, string> = {
  "stay-guest-bosteri": MEDIA.coast,
  "stay-hotel-aurora": MEDIA.lakeBlue,
  "stay-cottage-tamchy": MEDIA.coastBeach,
  "stay-yurt-sary-oi": MEDIA.yurtCamp,
  "stay-villa-cholpon-ata": MEDIA.lake,
  "stay-presidential-karakol": MEDIA.lakeSouth
};

const tourById: Record<string, string> = {
  "tour-boat-cholpon-ata": MEDIA.lake,
  "tour-horse-bosteri": MEDIA.lakeView,
  "tour-hot-springs-karakol": MEDIA.mountains,
  "tour-jeep-sary-oi": MEDIA.canyon,
  "tour-ethno-tamchy": MEDIA.yurt,
  "tour-karakol-city": MEDIA.canyonWide
};

const foodById: Record<string, string> = {
  "food-001": MEDIA.beshbarmak,
  "food-002": MEDIA.beshbarmakAlt,
  "food-003": MEDIA.manty,
  "food-004": MEDIA.bazaar,
  "food-005": MEDIA.beshbarmakAlt,
  "food-006": MEDIA.manty
};

const productById: Record<string, string> = {
  "product-001": MEDIA.lakeBlue,
  "product-002": MEDIA.bazaar,
  "product-003": MEDIA.coastBeach,
  "product-004": MEDIA.canyonWarm,
  "product-005": MEDIA.lake,
  "product-006": MEDIA.felt
};

export function stayImage(stay: Stay) {
  return stayById[stay.id] ?? (stay.type === "yurt_camp" ? MEDIA.yurtCamp : stay.type === "cottage" || stay.type === "villa" ? MEDIA.coast : MEDIA.lake);
}

export function tourImage(tour: Tour) {
  return tourById[tour.id] ?? MEDIA.canyon;
}

export function foodImage(food: FoodItem) {
  return foodById[food.id] ?? MEDIA.beshbarmak;
}

export function productImage(product: Product) {
  return productById[product.id] ?? (product.category === "Сувениры" ? MEDIA.feltMaking : MEDIA.coastBeach);
}
