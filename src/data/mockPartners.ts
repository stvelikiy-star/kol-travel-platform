import type { PartnerBusiness } from "@/types";

export const mockPartners: PartnerBusiness[] = [
  {
    id: "business-hotel-aurora",
    ownerUserId: "partner-001",
    type: "hotel",
    title: "Aurora Lake Hotel",
    slug: "aurora-lake-hotel",
    location: "Бактуу-Долоноту",
    description: "Отель у берега с семейными номерами и видом на озеро.",
    status: "approved",
    businessStatus: "online",
    rating: 4.7
  },
  {
    id: "business-guest-bosteri",
    ownerUserId: "partner-002",
    type: "guest_house",
    title: "Бостери Үй",
    slug: "bosteri-ui",
    location: "Бостери",
    description: "Гостевой дом рядом с пляжем и локальными кафе.",
    status: "approved",
    businessStatus: "online",
    rating: 4.5
  },
  {
    id: "business-restaurant-naryn",
    ownerUserId: "partner-003",
    type: "restaurant",
    title: "Нарын & Бешбармак",
    slug: "naryn-beshbarmak",
    location: "Чолпон-Ата",
    description: "Ресторан национальной кухни с доставкой по городу.",
    status: "approved",
    businessStatus: "online",
    rating: 4.8
  },
  {
    id: "business-cafe-tamchy",
    ownerUserId: "partner-004",
    type: "cafe",
    title: "Tamchy Breakfast",
    slug: "tamchy-breakfast",
    location: "Тамчы",
    description: "Кафе с завтраками, кофе и блюдами для доставки.",
    status: "approved",
    businessStatus: "paused",
    rating: 4.4
  },
  {
    id: "business-shop-sary-oi",
    ownerUserId: "partner-005",
    type: "shop",
    title: "Sary-Oi Market",
    slug: "sary-oi-market",
    location: "Сары-Ой",
    description: "Продукты, товары для отдыха и пляжные мелочи.",
    status: "approved",
    businessStatus: "online",
    rating: 4.3
  },
  {
    id: "business-tour-karakol",
    ownerUserId: "partner-006",
    type: "tour_operator",
    title: "Karakol Adventure",
    slug: "karakol-adventure",
    location: "Каракол",
    description: "Джип-туры, экскурсии и горячие источники.",
    status: "approved",
    businessStatus: "online",
    rating: 4.9
  },
  {
    id: "business-guide-bishkek",
    ownerUserId: "partner-007",
    type: "guide",
    title: "Эрмек Гид",
    slug: "ermek-guide",
    location: "Чолпон-Ата",
    description: "Частный гид по этно-турам и конным прогулкам.",
    status: "approved",
    businessStatus: "online",
    rating: 4.8
  }
];
