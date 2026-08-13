import type { FoodItem } from "@/types";

export const mockFood: FoodItem[] = [
  {
    id: "food-001",
    businessId: "business-restaurant-naryn",
    category: "Национальная кухня",
    title: "Бешбармак",
    description: "Классическое блюдо с мясом, лапшой и луком.",
    price: 620,
    currency: "KGS",
    status: "active"
  },
  {
    id: "food-002",
    businessId: "business-restaurant-naryn",
    category: "Национальная кухня",
    title: "Куурдак",
    description: "Жаркое с картофелем и мясом.",
    price: 540,
    currency: "KGS",
    status: "active"
  },
  {
    id: "food-003",
    businessId: "business-cafe-tamchy",
    category: "Завтраки",
    title: "Сырники с каймаком",
    description: "Завтрак для кафе и доставки.",
    price: 320,
    currency: "KGS",
    status: "active"
  },
  {
    id: "food-004",
    businessId: "business-cafe-tamchy",
    category: "Кафе",
    title: "Капучино и круассан",
    description: "Быстрый набор для утра.",
    price: 280,
    currency: "KGS",
    status: "active"
  },
  {
    id: "food-005",
    businessId: "business-restaurant-naryn",
    category: "Шашлык",
    title: "Шашлык из баранины",
    description: "Порция шашлыка с луком и лепёшкой.",
    price: 480,
    currency: "KGS",
    status: "active"
  },
  {
    id: "food-006",
    businessId: "business-cafe-tamchy",
    category: "Доставка",
    title: "Куриный боул",
    description: "Лёгкое блюдо для доставки на пляж.",
    price: 390,
    currency: "KGS",
    status: "active"
  }
];
