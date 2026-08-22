import type { FoodItem, Product, Stay, Tour } from "@/types";

// Direct, stable image URLs only. Browser QA fails the build on rendered media errors.
const MEDIA = {
  // Premium Issyk-Kul editorial photography (Unsplash, free-use source pages verified 2026-08-21).
  heroMountain: "https://images.unsplash.com/photo-1675157935570-e04938711f1e?auto=format&fit=crop&w=2000&q=85",
  travelerDock: "https://images.unsplash.com/photo-1692771395287-c91badaeb5e3?auto=format&fit=crop&w=1600&q=82",
  yurtStair: "https://images.unsplash.com/photo-1649938873286-6c3e5534a6e6?auto=format&fit=crop&w=1600&q=82",

  // User-requested contextual replacements for tours and shopping.
  // These replace the repeated generic lake image in places where a more specific visual is available.
  userBoatMarina: "https://snowreport.kg/sites/default/files/media/image/img_0399.jpg",
  userHorseBosteri: "https://images.putevka.com/blog_img/617_2510052024150.jpg",
  userKarakolValley: "https://triptokyrgyzstan.com/sites/default/files/media/image/c_genadii_vyenko_2.jpg",
  userSkazkaCanyon: "https://24.kg/files/media/258/258147.jpg",
  userJetiOguz: "https://dwc.kg/wp-content/uploads/2023/09/aec9734efffbc151803716b4b64eb824-748x750.jpg",
  userShopProduce: "https://cloudfront-us-east-1.images.arcpublishing.com/infobae/5RV4RQZAOZH35LQVEUHF6XGUH4.jpg",

  // Verified direct Wikimedia thumbnails avoid redirect/ORB failures seen in browser QA.
  lake: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Lake_Issyk-Kul%2C_Kyrgyzstan.jpg/1280px-Lake_Issyk-Kul%2C_Kyrgyzstan.jpg",
  ambientLake: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Lake_Issyk-Kul%2C_Kyrgyzstan.jpg/1280px-Lake_Issyk-Kul%2C_Kyrgyzstan.jpg",
  coast: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Issyk_Kul_Lake%2C_Issyk_Kul_region%2C_Kyrgyzstan.jpg/1280px-Issyk_Kul_Lake%2C_Issyk_Kul_region%2C_Kyrgyzstan.jpg",
  coastBeach: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Issyk_Kul_Lake%2C_Issyk_Kul_region%2C_Kyrgyzstan.jpg/1280px-Issyk_Kul_Lake%2C_Issyk_Kul_region%2C_Kyrgyzstan.jpg",
  lakeBlue: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Lake_Issyk-Kul%2C_Kyrgyzstan.jpg/1280px-Lake_Issyk-Kul%2C_Kyrgyzstan.jpg",
  lakeSouth: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Issyk_Kul_Lake%2C_Issyk_Kul_region%2C_Kyrgyzstan.jpg/1280px-Issyk_Kul_Lake%2C_Issyk_Kul_region%2C_Kyrgyzstan.jpg",
  lakeView: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Lake_Issyk-Kul%2C_Kyrgyzstan.jpg/1280px-Lake_Issyk-Kul%2C_Kyrgyzstan.jpg",
  canyon: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg/1280px-Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg",
  canyonWide: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg/1280px-Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg",
  canyonWarm: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg/1280px-Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg",
  mountains: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Lake_Issyk-Kul%2C_Kyrgyzstan.jpg/1280px-Lake_Issyk-Kul%2C_Kyrgyzstan.jpg",
  yurtCamp: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Yurta_camp_in_the_southern_shore_of_Issyk-Kul.jpg/1280px-Yurta_camp_in_the_southern_shore_of_Issyk-Kul.jpg",
  yurt: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Kyrgyz_Yurt%2C_Kyrgyzstan.jpg/1280px-Kyrgyz_Yurt%2C_Kyrgyzstan.jpg",
  beshbarmak: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/%D0%91%D0%B5%D1%88%D0%B1%D0%B0%D1%80%D0%BC%D0%B0%D0%BA.jpg/1280px-%D0%91%D0%B5%D1%88%D0%B1%D0%B0%D1%80%D0%BC%D0%B0%D0%BA.jpg",
  beshbarmakAlt: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/E7870-Dordoy-laghman.jpg/960px-E7870-Dordoy-laghman.jpg",
  manty: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/FOOD_Mantu.jpg/1280px-FOOD_Mantu.jpg",
  bazaar: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Osh_Bazaar_in_Bishkek%2C_Kyrgyzstan-_dried_fruits_and_nuts.jpg/1280px-Osh_Bazaar_in_Bishkek%2C_Kyrgyzstan-_dried_fruits_and_nuts.jpg",
  felt: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Felt_toys_in_Kyrgyzstan.jpg/1280px-Felt_toys_in_Kyrgyzstan.jpg",
  feltMaking: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Felt_toys_in_Kyrgyzstan.jpg/1280px-Felt_toys_in_Kyrgyzstan.jpg",
  woolFelt: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Felt_toys_in_Kyrgyzstan.jpg/1280px-Felt_toys_in_Kyrgyzstan.jpg"
} as const;

export const presentationMedia = MEDIA;

const stayById: Record<string, string> = {
  "stay-guest-bosteri": MEDIA.coast,
  "stay-hotel-aurora": MEDIA.heroMountain,
  "stay-cottage-tamchy": MEDIA.coastBeach,
  "stay-yurt-sary-oi": MEDIA.yurtCamp,
  "stay-villa-cholpon-ata": MEDIA.travelerDock,
  "stay-presidential-karakol": MEDIA.lakeSouth
};

const tourById: Record<string, string> = {
  "tour-boat-cholpon-ata": MEDIA.userBoatMarina,
  "tour-horse-bosteri": MEDIA.userHorseBosteri,
  "tour-hot-springs-karakol": MEDIA.userKarakolValley,
  "tour-jeep-sary-oi": MEDIA.userSkazkaCanyon,
  "tour-ethno-tamchy": MEDIA.yurtStair,
  "tour-karakol-city": MEDIA.bazaar
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
  "product-001": MEDIA.bazaar,
  "product-002": MEDIA.userShopProduce,
  "product-003": MEDIA.coastBeach,
  "product-004": MEDIA.canyonWarm,
  "product-005": MEDIA.lake,
  "product-006": MEDIA.felt
};

export function stayImage(stay: Stay) {
  return stayById[stay.id] ?? (stay.type === "yurt_camp" ? MEDIA.yurtCamp : stay.type === "cottage" || stay.type === "villa" ? MEDIA.coast : MEDIA.lake);
}

export function tourImage(tour: Tour) {
  return tourById[tour.id] ?? MEDIA.userJetiOguz;
}

export function foodImage(food: FoodItem) {
  return foodById[food.id] ?? MEDIA.beshbarmak;
}

export function productImage(product: Product) {
  return productById[product.id] ?? (product.category === "Сувениры" ? MEDIA.feltMaking : MEDIA.userShopProduce);
}
