import type { Room, RoomAvailability, Stay } from "@/types";

export const mockStays: Stay[] = [
  {
    id: "stay-guest-bosteri",
    businessId: "business-guest-bosteri",
    title: "Гостевой дом Бостери Үй",
    slug: "guest-house-bosteri-ui",
    type: "guest_house",
    location: "Бостери",
    description: "Уютные комнаты, двор и быстрый выход к пляжу.",
    rating: 4.5,
    minPricePerNight: 2800,
    currency: "KGS",
    status: "active"
  },
  {
    id: "stay-hotel-aurora",
    businessId: "business-hotel-aurora",
    title: "Aurora Lake Hotel",
    slug: "aurora-lake-hotel",
    type: "hotel",
    location: "Бактуу-Долоноту",
    description: "Отель с завтраками, парковкой и семейными номерами.",
    rating: 4.7,
    minPricePerNight: 6200,
    currency: "KGS",
    status: "active"
  },
  {
    id: "stay-cottage-tamchy",
    businessId: "business-hotel-aurora",
    title: "Коттедж у Тамчы",
    slug: "tamchy-lake-cottage",
    type: "cottage",
    location: "Тамчы",
    description: "Дом для семьи или компании рядом с аэропортом.",
    rating: 4.6,
    minPricePerNight: 9000,
    currency: "KGS",
    status: "active"
  },
  {
    id: "stay-yurt-sary-oi",
    businessId: "business-guest-bosteri",
    title: "Юрточный лагерь Сары-Ой",
    slug: "sary-oi-yurt-camp",
    type: "yurt_camp",
    location: "Сары-Ой",
    description: "Юрты, ужин у костра и вид на озеро.",
    rating: 4.4,
    minPricePerNight: 3500,
    currency: "KGS",
    status: "active"
  },
  {
    id: "stay-villa-cholpon-ata",
    businessId: "business-hotel-aurora",
    title: "Премиум вилла Чолпон-Ата",
    slug: "premium-villa-cholpon-ata",
    type: "villa",
    location: "Чолпон-Ата",
    description: "Приватная вилла с террасой и зоной барбекю.",
    rating: 4.9,
    minPricePerNight: 28000,
    currency: "KGS",
    status: "active"
  },
  {
    id: "stay-presidential-karakol",
    businessId: "business-hotel-aurora",
    title: "Президентский номер Каракол",
    slug: "presidential-room-karakol",
    type: "hotel",
    location: "Каракол",
    description: "Просторный номер для VIP-гостей и деловых поездок.",
    rating: 4.8,
    minPricePerNight: 22000,
    currency: "KGS",
    status: "active"
  }
];

export const mockRooms: Room[] = [
  { id: "room-001", stayId: "stay-guest-bosteri", title: "Семейная комната", capacity: 4, pricePerNight: 4200, currency: "KGS", status: "active" },
  { id: "room-002", stayId: "stay-hotel-aurora", title: "Стандарт с видом на озеро", capacity: 2, pricePerNight: 6200, currency: "KGS", status: "active" },
  { id: "room-003", stayId: "stay-presidential-karakol", title: "Президентский номер", capacity: 3, pricePerNight: 22000, currency: "KGS", status: "active" }
];

export const mockRoomAvailability: RoomAvailability[] = [
  { id: "availability-001", roomId: "room-001", date: "2026-07-01", status: "available", pricePerNight: 4200 },
  { id: "availability-002", roomId: "room-002", date: "2026-07-01", status: "booked", pricePerNight: 6200 },
  { id: "availability-003", roomId: "room-003", date: "2026-07-02", status: "available", pricePerNight: 22000 }
];
