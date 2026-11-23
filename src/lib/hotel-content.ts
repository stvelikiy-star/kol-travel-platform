export type HotelPublicContent = {
  slug: string;
  highlights: string[];
  rules: { label: string; value: string }[];
  extras?: string[];
  priceNote?: string;
};

export const hotelPublicContent: Record<string, HotelPublicContent> = {
  "ak-bermet-spa-wellness": {
    slug: "ak-bermet-spa-wellness",
    highlights: ["Горячие минеральные источники", "SPA и крытый бассейн", "Тренажёрный зал", "Благоустроенный пляж", "Трёхразовое питание"],
    rules: [
      { label: "Заезд", value: "13:00" },
      { label: "Выезд", value: "11:00" },
      { label: "Предоплата", value: "за первые сутки" },
      { label: "Языки", value: "RU · KG · KZ · EN" }
    ],
    extras: ["Доп. место ребёнку 3+ — 1 500 KGS", "Доп. место взрослому — 1 800 KGS", "Парковка — 100 KGS / сутки"],
    priceNote: "Для части категорий действует сезонный тариф. Точные границы двух ценовых периодов подтверждаются менеджером перед бронью."
  },
  "bakyt-hotel": {
    slug: "bakyt-hotel",
    highlights: ["Зелёная территория", "Пляж", "Коттеджи и юрты", "Столовая", "Банкетная инфраструктура"],
    rules: [
      { label: "Сезон", value: "май — октябрь" },
      { label: "Заезд", value: "14:00" },
      { label: "Выезд", value: "12:00" },
      { label: "Предоплата", value: "50%" },
      { label: "Резерв", value: "до 3 суток" }
    ],
    extras: ["Доп. место — 1 000–1 500 KGS по периоду", "Дети до 3 лет — бесплатно", "Дети 3–10 лет — скидка 20%", "Питание взрослому — 1 300 KGS, ребёнку — 800 KGS"],
    priceNote: "Тарифы 2026 зависят от категории, периода и дня недели. Финальная стоимость подтверждается менеджером."
  },
  "tri-korony-resort": {
    slug: "tri-korony-resort",
    highlights: ["Собственный пляж", "Пирс", "SPA", "Открытый бассейн", "12 категорий размещения"],
    rules: [
      { label: "Предоплата", value: "за первые сутки" },
      { label: "Резерв без предоплаты", value: "2 дня" },
      { label: "Адрес", value: "Иманбай Молдо, Чолпон-Ата" },
      { label: "Телефон", value: "+996 558 08 50 02" }
    ],
    priceNote: "С 16 сентября по 31 мая тариф без завтрака; в остальные опубликованные тарифные периоды завтрак включён."
  },
  "paladin-guest-house": {
    slug: "paladin-guest-house",
    highlights: ["20 номеров", "Столовая", "Внутренняя парковка", "BBQ-зона", "Семейный формат"],
    rules: [
      { label: "Заезд", value: "14:00" },
      { label: "Выезд", value: "12:00" },
      { label: "Предоплата", value: "2 000 KGS за номер" },
      { label: "Тариф", value: "1 500 KGS / человек / сутки, без питания" }
    ],
    extras: ["Доп. кровать — 500 KGS", "Завтрак — 300 KGS", "Ужин — 350 KGS", "Парковка — 100 KGS", "BBQ-набор — 200 KGS"],
    priceNote: "PALADIN тарифицируется за человека в сутки. Цена не должна автоматически трактоваться как стоимость номера."
  }
};

export function getHotelPublicContent(slug: string) {
  return hotelPublicContent[slug];
}
