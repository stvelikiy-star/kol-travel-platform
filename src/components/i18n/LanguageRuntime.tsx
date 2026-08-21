"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Locale = "ru" | "ky";

const EN_TO_RU: Record<string, string> = {
  "Client cabinet": "Кабинет клиента",
  "Partner cabinet": "Кабинет партнёра",
  "Courier cabinet": "Кабинет курьера",
  "Admin panel": "Админ-панель",
  "Quick actions": "Быстрые действия",
  "Recent orders": "Последние заказы",
  "Recent bookings": "Последние бронирования",
  "Delivery statuses": "Статусы доставки",
  "AI dispatcher": "AI-диспетчер",
  "Business active": "Бизнес активен",
  "Delivery active": "Доставка активна",
  "Booking active": "Бронирование активно",
  "active": "активно",
  "pending": "ожидает",
  "confirmed": "подтверждено",
  "completed": "завершено",
  "cancelled": "отменено",
  "rejected": "отклонено",
  "online": "онлайн",
  "offline": "офлайн",
  "paused": "приостановлено",
  "unavailable": "недоступно",
  "accepted": "принято",
  "preparing": "готовится",
  "assembling": "комплектуется",
  "ready": "готово",
  "delivering": "доставляется",
  "delivered": "доставлено",
  "low": "низкий",
  "medium": "средний",
  "high": "высокий",
  "critical": "критический"
};

const RU_TO_KY: Record<string, string> = {
  "Главная": "Башкы бет",
  "Туры": "Турлар",
  "Жильё": "Турак жай",
  "Еда": "Тамак-аш",
  "Магазин": "Дүкөн",
  "Партнёрам": "Өнөктөштөргө",
  "Партнёры": "Өнөктөштөр",
  "Контакты": "Байланыш",
  "Корзина": "Себет",
  "Войти": "Кирүү",
  "Стать партнёром": "Өнөктөш болуу",
  "На главную": "Башкы бетке",
  "Клиент": "Кардар",
  "Кабинет клиента": "Кардардын кабинети",
  "Партнёр": "Өнөктөш",
  "Кабинет партнёра": "Өнөктөштүн кабинети",
  "Курьер": "Курьер",
  "Кабинет курьера": "Курьердин кабинети",
  "Администратор": "Администратор",
  "Админ-панель": "Админ-панель",
  "Собственник": "Ээси",
  "Кабинет собственника": "Ээсинин кабинети",
  "Обзор": "Сереп",
  "Пользователи": "Колдонуучулар",
  "Клиенты": "Кардарлар",
  "Курьеры": "Курьерлер",
  "Заказы": "Заказдар",
  "Заказ": "Заказ",
  "Брони": "Брондор",
  "Бронирования": "Брондоолор",
  "Бронь": "Бронь",
  "Доставка": "Жеткирүү",
  "Доставки": "Жеткирүүлөр",
  "Финансы": "Каржы",
  "Модерация": "Модерация",
  "Настройки": "Жөндөөлөр",
  "Каталог": "Каталог",
  "Доступность": "Жеткиликтүүлүк",
  "Аналитика": "Аналитика",
  "Отзывы": "Пикирлер",
  "Акции": "Акциялар",
  "Поддержка": "Колдоо",
  "Избранное": "Тандалмалар",
  "Предложения": "Сунуштар",
  "Баллы": "Упайлар",
  "Профиль": "Профиль",
  "История": "Тарых",
  "Проблемы": "Көйгөйлөр",
  "Активная доставка": "Активдүү жеткирүү",
  "Новые доставки": "Жаңы жеткирүүлөр",
  "Активные доставки": "Активдүү жеткирүүлөр",
  "Завершено сегодня": "Бүгүн аяктады",
  "Активные заказы": "Активдүү заказдар",
  "Активные брони": "Активдүү брондор",
  "Новые заказы": "Жаңы заказдар",
  "Последние заказы": "Акыркы заказдар",
  "Последние бронирования": "Акыркы брондоолор",
  "Последние брони": "Акыркы брондор",
  "Быстрые действия": "Тез аракеттер",
  "Открыть заказы": "Заказдарды ачуу",
  "Открыть брони": "Брондорду ачуу",
  "Открыть доставки": "Жеткирүүлөрдү ачуу",
  "Все заказы": "Бардык заказдар",
  "Все брони": "Бардык брондор",
  "Найти тур": "Тур табуу",
  "Найти жильё": "Турак жай табуу",
  "Заказать еду": "Тамак-аш заказ кылуу",
  "Смотреть туры": "Турларды көрүү",
  "Смотреть жильё": "Турак жайды көрүү",
  "Выбрать номер": "Бөлмө тандоо",
  "Забронировать": "Брондоо",
  "Забронировать жильё": "Турак жайды брондоо",
  "Забронировать тур": "Турду брондоо",
  "В корзину": "Себетке",
  "Добавить в корзину": "Себетке кошуу",
  "Оформить заказ": "Заказды тариздөө",
  "Продолжить": "Улантуу",
  "Назад": "Артка",
  "Цена": "Баасы",
  "За ночь": "Бир түнгө",
  "от": "баштап",
  "гостей": "конок",
  "Гостей": "Коноктор",
  "Участников": "Катышуучулар",
  "Заезд": "Келүү күнү",
  "Выезд": "Чыгуу күнү",
  "Дата и время": "Күнү жана убактысы",
  "Номер": "Бөлмө",
  "Свободно": "Бош",
  "Места доступны": "Бош орундар бар",
  "вместимость уточняется": "сыйымдуулугу такталат",
  "Проверяем доступность…": "Жеткиликтүүлүк текшерилүүдө…",
  "Проверяем места…": "Бош орундар текшерилүүдө…",
  "Бронь создана": "Бронь түзүлдү",
  "Онлайн-бронирование временно недоступно.": "Онлайн брондоо убактылуу жеткиликсиз.",
  "Для бронирования войдите в аккаунт KÖL.": "Брондоо үчүн KÖL аккаунтуңузга кириңиз.",
  "Проверьте даты заезда и выезда.": "Келүү жана чыгуу күндөрүн текшериңиз.",
  "Проверьте количество гостей.": "Коноктордун санын текшериңиз.",
  "Проверьте количество участников.": "Катышуучулардын санын текшериңиз.",
  "Весь Иссык-Куль в одной платформе": "Бүтүндөй Ысык-Көл бир платформада",
  "Туры, жильё, доставка еды, магазин, акции и бронирование — всё для отдыха на Иссык-Куле в одном сервисе.": "Турлар, турак жай, тамак-аш жеткирүү, дүкөн, акциялар жана брондоо — Ысык-Көлдөгү эс алуу үчүн баары бир сервисте.",
  "Что нужно для отдыха": "Эс алуу үчүн керектүүнүн баары",
  "Популярные туры": "Популярдуу турлар",
  "Лучшее жильё": "Мыкты турак жайлар",
  "Еда с доставкой": "Жеткирүү менен тамак-аш",
  "Магазин для отдыха": "Эс алуу үчүн дүкөн",
  "Партнёры KÖL": "KÖL өнөктөштөрү",
  "Как это работает": "Кантип иштейт",
  "Начните отдых на Иссык-Куле уже сейчас": "Ысык-Көлдөгү эс алууну азыр баштаңыз",
  "Единый операционный центр": "Бирдиктүү операциялык борбор",
  "Заказы, бронирования, доставки, партнёры, модерация, финансы и контроль рисков — в одном кабинете.": "Заказдар, брондоолор, жеткирүүлөр, өнөктөштөр, модерация, каржы жана тобокелдиктерди көзөмөлдөө — бир кабинетте.",
  "Требуют внимания": "Көңүл бурууну талап кылат",
  "Риски доставки": "Жеткирүү тобокелдиктери",
  "AI-диспетчер": "AI-диспетчер",
  "Контроль и безопасность": "Көзөмөл жана коопсуздук",
  "Кабинет партнёра": "Өнөктөштүн кабинети",
  "Операционный статус": "Операциялык абал",
  "Профиль партнёра": "Өнөктөштүн профили",
  "Бизнес": "Бизнес",
  "Тип": "Түрү",
  "Локация": "Жайгашкан жери",
  "Рейтинг": "Рейтинг",
  "Кабинет курьера": "Курьердин кабинети",
  "Профиль курьера": "Курьердин профили",
  "Статус доступности": "Жеткиликтүүлүк абалы",
  "Следующий шаг": "Кийинки кадам",
  "Маршрут": "Маршрут",
  "Кабинет собственника": "Ээсинин кабинети",
  "Управление экосистемой": "Экосистеманы башкаруу",
  "Операционная сводка": "Операциялык жыйынтык",
  "Перейти в админку": "Админ-панелге өтүү",
  "Перейти к партнёрам": "Өнөктөштөргө өтүү",
  "Открыть кабинет курьера": "Курьер кабинетин ачуу",
  "Открыть клиентский путь": "Кардардын жолун ачуу",
  "активно": "активдүү",
  "ожидает": "күтүүдө",
  "подтверждено": "ырасталды",
  "завершено": "аяктады",
  "отменено": "жокко чыгарылды",
  "отклонено": "четке кагылды",
  "онлайн": "онлайн",
  "офлайн": "офлайн",
  "приостановлено": "убактылуу токтотулду",
  "недоступно": "жеткиликсиз",
  "принято": "кабыл алынды",
  "готовится": "даярдалууда",
  "комплектуется": "топтолууда",
  "готово": "даяр",
  "доставляется": "жеткирилүүдө",
  "доставлено": "жеткирилди",
  "низкий": "төмөн",
  "средний": "орточо",
  "высокий": "жогору",
  "критический": "критикалык"
};

const textOriginals = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "PRE", "CODE"]);

function replaceDictionary(value: string, dictionary: Record<string, string>) {
  const entries = Object.entries(dictionary).sort((a, b) => b[0].length - a[0].length);
  return entries.reduce((result, [from, to]) => result.split(from).join(to), value);
}

function translated(value: string, locale: Locale) {
  const russian = replaceDictionary(value, EN_TO_RU);
  return locale === "ky" ? replaceDictionary(russian, RU_TO_KY) : russian;
}

function translateTree(root: Node, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || ignoredTags.has(parent.tagName)) continue;
    const original = textOriginals.get(node) ?? node.nodeValue ?? "";
    if (!textOriginals.has(node)) textOriginals.set(node, original);
    const next = translated(original, locale);
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  if (root instanceof Element) translateElementAttributes(root, locale);
  if (root instanceof Document || root instanceof DocumentFragment || root instanceof Element) {
    root.querySelectorAll?.("[placeholder],[title],[aria-label]").forEach((element) => translateElementAttributes(element, locale));
  }
}

function translateElementAttributes(element: Element, locale: Locale) {
  const names = ["placeholder", "title", "aria-label"];
  let originals = attrOriginals.get(element);
  if (!originals) {
    originals = new Map<string, string>();
    attrOriginals.set(element, originals);
  }

  for (const name of names) {
    const value = element.getAttribute(name);
    if (value === null) continue;
    const original = originals.get(name) ?? value;
    if (!originals.has(name)) originals.set(name, original);
    element.setAttribute(name, translated(original, locale));
  }
}

export function LanguageRuntime() {
  const [locale, setLocale] = useState<Locale>("ru");
  const applying = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("kol-locale");
    if (stored === "ky") setLocale("ky");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kol-locale", locale);
    document.documentElement.lang = locale === "ky" ? "ky" : "ru";

    const apply = (root: Node = document.body) => {
      if (applying.current) return;
      applying.current = true;
      try {
        translateTree(root, locale);
      } finally {
        applying.current = false;
      }
    };

    apply();
    const observer = new MutationObserver((mutations) => {
      if (applying.current) return;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => apply(node));
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  return (
    <div className="fixed bottom-3 left-1/2 z-[100] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-white/30 bg-slate-950/95 p-1.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:gap-2 sm:p-2">
      <div className="flex shrink-0 rounded-xl bg-white/10 p-1">
        <button
          className={`rounded-lg px-3 py-2 text-xs font-bold transition ${locale === "ru" ? "bg-white text-slate-950" : "text-white/80 hover:bg-white/10"}`}
          onClick={() => setLocale("ru")}
          type="button"
        >
          RU
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-xs font-bold transition ${locale === "ky" ? "bg-cyan-300 text-slate-950" : "text-white/80 hover:bg-white/10"}`}
          onClick={() => setLocale("ky")}
          type="button"
        >
          KG
        </button>
      </div>
      <div className="h-7 w-px shrink-0 bg-white/20" />
      <RoleLink href="/" label="Главная" />
      <RoleLink href="/owner" label="Собственник" />
      <RoleLink href="/partner" label="Партнёр" />
      <RoleLink href="/courier" label="Курьер" />
      <RoleLink href="/admin" label="Администратор" />
      <RoleLink href="/client" label="Клиент" />
    </div>
  );
}

function RoleLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 hover:text-white" href={href}>
      {label}
    </Link>
  );
}
