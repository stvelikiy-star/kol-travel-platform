import type { FoodItem, Product, Stay, Tour } from "@/types";

// Direct, stable image URLs only. Browser QA fails the build on rendered media errors.
const MEDIA = {
  kolLogo: "/media/kol/kol-logo.jpg",
  // Brand section art supplied for the KÖL showcase.
  kolDelivery: "/media/kol/sections/delivery.webp",
  kolTours: "/media/kol/sections/tours.webp",
  kolStays: "/media/kol/sections/stays.webp",
  kolBeach: "/media/kol/sections/beach.webp",
  kolFood: "/media/kol/sections/food.webp",
  kolShop: "/media/kol/sections/shop.webp",
  akBermetHero: "/media/hotels/gallery/ak-bermet/overview.jpg",
  bakytHero: "/media/hotels/gallery/bakyt/hero.jpg",
  threeCrownsHero: "/media/hotels/gallery/three-crowns/hero.jpg",
  paladinHero: "/media/hotels/gallery/paladin/hero.jpg",
  akBermetLogo: "/media/hotels/ak-bermet-logo.png",
  bakytLogo: "/media/hotels/bakyt-logo.png",
  threeCrownsLogo: "/media/hotels/three-crowns-logo.png",
  paladinLogo: "/media/hotels/paladin-logo.png",
  // Premium Issyk-Kul editorial photography (Unsplash, free-use source pages verified 2026-08-21).
  heroMountain: "/media/kol/sections/beach.webp",
  travelerDock: "/media/kol/sections/stays.webp",
  yurtStair: "https://images.unsplash.com/photo-1649938873286-6c3e5534a6e6?auto=format&fit=crop&w=1600&q=82",

  // User-requested contextual replacements for tours and shopping.
  // These replace the repeated generic lake image in places where a more specific visual is available.
  userBoatMarina: "/media/kol/sections/tours.webp",
  userHorseBosteri: "https://images.putevka.com/blog_img/617_2510052024150.jpg",
  userKarakolValley: "https://triptokyrgyzstan.com/sites/default/files/media/image/c_genadii_vyenko_2.jpg",
  userSkazkaCanyon: "https://24.kg/files/media/258/258147.jpg",
  userJetiOguz: "https://dwc.kg/wp-content/uploads/2023/09/aec9734efffbc151803716b4b64eb824-748x750.jpg",
  userShopProduce: "/media/kol/sections/shop.webp",

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

const stayBySlug: Record<string, string> = {
  "ak-bermet-spa-wellness": MEDIA.akBermetHero,
  "bakyt-hotel": MEDIA.bakytHero,
  "bakyt-cholpon-ata": MEDIA.bakytHero,
  "tri-korony-resort": MEDIA.threeCrownsHero,
  "three-crowns-resort-spa": MEDIA.threeCrownsHero,
  "paladin-guest-house": MEDIA.paladinHero,
  "paladin-cholpon-ata": MEDIA.paladinHero
};

const stayLogoBySlug: Record<string, string> = {
  "ak-bermet-spa-wellness": MEDIA.akBermetLogo,
  "bakyt-hotel": MEDIA.bakytLogo,
  "bakyt-cholpon-ata": MEDIA.bakytLogo,
  "tri-korony-resort": MEDIA.threeCrownsLogo,
  "three-crowns-resort-spa": MEDIA.threeCrownsLogo,
  "paladin-guest-house": MEDIA.paladinLogo,
  "paladin-cholpon-ata": MEDIA.paladinLogo
};

const stayGalleryBySlug: Record<string, string[]> = {
  "ak-bermet-spa-wellness": [
    MEDIA.akBermetHero,
    "/media/hotels/gallery/ak-bermet/twin-room.jpg",
    "/media/hotels/gallery/ak-bermet/double-room.jpg",
    "/media/hotels/gallery/ak-bermet/family-room.jpg",
    "/media/hotels/gallery/ak-bermet/hot-springs.jpg",
    "/media/hotels/gallery/ak-bermet/indoor-pool.jpg"
  ],
  "bakyt-hotel": [
    MEDIA.bakytHero,
    "/media/hotels/gallery/bakyt/building.jpg",
    "/media/hotels/gallery/bakyt/room.jpg",
    "/media/hotels/gallery/bakyt/room-alt.jpg",
    "/media/hotels/gallery/bakyt/yurt-dining.jpg",
    "/media/hotels/gallery/bakyt/beach.jpg"
  ],
  "tri-korony-resort": [
    MEDIA.threeCrownsHero,
    "/media/hotels/gallery/three-crowns/garden.jpg",
    "/media/hotels/gallery/three-crowns/pool.jpg",
    "/media/hotels/gallery/three-crowns/suite.jpg",
    "/media/hotels/gallery/three-crowns/room.jpg"
  ],
  "paladin-guest-house": [
    MEDIA.paladinHero,
    "/media/hotels/gallery/paladin/room.jpg",
    "/media/hotels/gallery/paladin/building.jpg",
    "/media/hotels/gallery/paladin/courtyard.jpg",
    "/media/hotels/gallery/paladin/dining.jpg"
  ]
};

function hotelAssetByText(stay: Stay, assets: { akBermet: string; bakyt: string; threeCrowns: string; paladin: string }) {
  const text = `${stay.slug} ${stay.title}`.toLocaleLowerCase("ru");
  if (text.includes("ak-bermet") || text.includes("ак-б") || text.includes("ак‑б")) return assets.akBermet;
  if (text.includes("bakyt") || text.includes("бакыт")) return assets.bakyt;
  if (text.includes("tri-korony") || text.includes("three-crowns") || text.includes("три короны")) return assets.threeCrowns;
  if (text.includes("paladin") || text.includes("паладин")) return assets.paladin;
  return undefined;
}

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
  return stayBySlug[stay.slug] ?? hotelAssetByText(stay, {
    akBermet: MEDIA.akBermetHero,
    bakyt: MEDIA.bakytHero,
    threeCrowns: MEDIA.threeCrownsHero,
    paladin: MEDIA.paladinHero
  }) ?? stayById[stay.id] ?? (stay.type === "yurt_camp" ? MEDIA.yurtCamp : stay.type === "cottage" || stay.type === "villa" ? MEDIA.coast : MEDIA.lake);
}

export function stayLogo(stay: Stay) {
  return stayLogoBySlug[stay.slug] ?? hotelAssetByText(stay, {
    akBermet: MEDIA.akBermetLogo,
    bakyt: MEDIA.bakytLogo,
    threeCrowns: MEDIA.threeCrownsLogo,
    paladin: MEDIA.paladinLogo
  });
}

export function stayGallery(stay: Stay) {
  const gallery = stayGalleryBySlug[stay.slug];
  return gallery?.length ? gallery : [stayImage(stay)];
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
