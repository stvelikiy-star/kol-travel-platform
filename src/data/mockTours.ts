import type { Tour, TourSchedule } from "@/types";

export const mockTours: Tour[] = [
  {
    id: "tour-boat-cholpon-ata",
    businessId: "business-guide-bishkek",
    title: "Прогулка на катере по Иссык-Кулю",
    slug: "boat-trip-cholpon-ata",
    location: "Чолпон-Ата",
    description: "Маршрут вдоль берега с остановкой для фото и купания.",
    price: 2500,
    currency: "KGS",
    duration: "1.5 часа",
    status: "active",
    rating: 4.8
  },
  {
    id: "tour-horse-bosteri",
    businessId: "business-guide-bishkek",
    title: "Конная прогулка у Бостери",
    slug: "horse-tour-bosteri",
    location: "Бостери",
    description: "Спокойный маршрут для новичков с инструктором.",
    price: 1800,
    currency: "KGS",
    duration: "2 часа",
    status: "active",
    rating: 4.6
  },
  {
    id: "tour-hot-springs-karakol",
    businessId: "business-tour-karakol",
    title: "Горячие источники Каракола",
    slug: "hot-springs-karakol",
    location: "Каракол",
    description: "Трансфер, купание в источниках и короткая прогулка.",
    price: 4200,
    currency: "KGS",
    duration: "5 часов",
    status: "active",
    rating: 4.9
  },
  {
    id: "tour-jeep-sary-oi",
    businessId: "business-tour-karakol",
    title: "Джип-тур к панорамным точкам",
    slug: "jeep-tour-sary-oi",
    location: "Сары-Ой",
    description: "Горные дороги, виды на озеро и пикник.",
    price: 6500,
    currency: "KGS",
    duration: "6 часов",
    status: "active",
    rating: 4.7
  },
  {
    id: "tour-ethno-tamchy",
    businessId: "business-guide-bishkek",
    title: "Этно-тур с мастер-классом",
    slug: "ethno-tour-tamchy",
    location: "Тамчы",
    description: "Юрта, локальная кухня и ремесленный мастер-класс.",
    price: 3200,
    currency: "KGS",
    duration: "3 часа",
    status: "active",
    rating: 4.8
  },
  {
    id: "tour-karakol-city",
    businessId: "business-tour-karakol",
    title: "Экскурсия в Каракол",
    slug: "karakol-city-tour",
    location: "Каракол",
    description: "Городской маршрут, рынок, музей и исторические места.",
    price: 3000,
    currency: "KGS",
    duration: "4 часа",
    status: "active",
    rating: 4.5
  }
];

export const mockTourSchedules: TourSchedule[] = [
  { id: "schedule-001", tourId: "tour-boat-cholpon-ata", date: "2026-09-05", startTime: "10:00", capacity: 8, bookedSeats: 3, status: "available" },
  { id: "schedule-002", tourId: "tour-horse-bosteri", date: "2026-09-05", startTime: "16:00", capacity: 6, bookedSeats: 6, status: "booked" },
  { id: "schedule-003", tourId: "tour-hot-springs-karakol", date: "2026-09-06", startTime: "09:00", capacity: 12, bookedSeats: 5, status: "available" }
];
