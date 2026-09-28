import type { Room, RoomAvailability, Stay } from "@/types";

export const mockStays: Stay[] = [
  {
    id: "stay-ak-bermet",
    businessId: "business-ak-bermet",
    title: "Ак‑Бермет Spa & Wellness",
    slug: "ak-bermet-spa-wellness",
    type: "hotel",
    location: "Иссык‑Куль",
    description: "Оздоровительный комплекс с горячими минеральными источниками, SPA, крытым бассейном, питанием и благоустроенным пляжем.",
    rating: 0,
    minPricePerNight: 8100,
    currency: "KGS",
    status: "active"
  },
  {
    id: "stay-bakyt",
    businessId: "business-bakyt",
    title: "Отель «Бакыт»",
    slug: "bakyt-cholpon-ata",
    type: "hotel",
    location: "Чолпон‑Ата",
    description: "Сезонный отель с корпусами, коттеджами, юртами, столовой и пространствами для семейного и группового отдыха.",
    rating: 0,
    minPricePerNight: 2600,
    currency: "KGS",
    status: "active"
  },
  {
    id: "stay-three-crowns",
    businessId: "business-three-crowns",
    title: "Три Короны Resort & SPA",
    slug: "three-crowns-resort-spa",
    type: "hotel",
    location: "Чолпон‑Ата",
    description: "Курортный комплекс с собственным пляжем, 150‑метровым пирсом, SPA, открытым бассейном и 12 категориями размещения.",
    rating: 0,
    minPricePerNight: 3000,
    currency: "KGS",
    status: "active"
  },
  {
    id: "stay-paladin",
    businessId: "business-paladin",
    title: "Гостевой дом PALADIN",
    slug: "paladin-cholpon-ata",
    type: "guest_house",
    location: "Чолпон‑Ата",
    description: "Семейный гостевой дом с 20 номерами, столовой, внутренней парковкой и мангальной зоной рядом с пляжем.",
    rating: 0,
    minPricePerNight: 1500,
    currency: "KGS",
    status: "active"
  }
];

export const mockRooms: Room[] = [
  { id: "room-ak-bermet", stayId: "stay-ak-bermet", title: "Двухместный номер", capacity: 2, pricePerNight: 8100, currency: "KGS", status: "active" },
  { id: "room-bakyt", stayId: "stay-bakyt", title: "Коттедж — полулюкс", capacity: 2, pricePerNight: 2600, currency: "KGS", status: "active" },
  { id: "room-three-crowns", stayId: "stay-three-crowns", title: "Одноместный номер", capacity: 1, pricePerNight: 3000, currency: "KGS", status: "active" },
  { id: "room-paladin", stayId: "stay-paladin", title: "Номер для 3–4 гостей", capacity: 4, pricePerNight: 1500, currency: "KGS", status: "active" }
];

export const mockRoomAvailability: RoomAvailability[] = [
  { id: "availability-ak-bermet", roomId: "room-ak-bermet", date: "2026-07-01", status: "available", pricePerNight: 8100 },
  { id: "availability-bakyt", roomId: "room-bakyt", date: "2026-07-01", status: "available", pricePerNight: 2600 },
  { id: "availability-three-crowns", roomId: "room-three-crowns", date: "2026-07-01", status: "available", pricePerNight: 3000 },
  { id: "availability-paladin", roomId: "room-paladin", date: "2026-07-01", status: "available", pricePerNight: 1500 }
];
