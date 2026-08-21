"use client";

import { useMemo, useState } from "react";

type Language = "ru" | "ky";
type ServiceKey = "stay" | "tours" | "food" | "shop";
type RoleKey = "client" | "partner" | "courier" | "admin";

const images = {
  hero: "https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Issyk-Kul%2C%20Kyrgyzstan.jpg",
  stay: "https://commons.wikimedia.org/wiki/Special:FilePath/Kyrgyz%20Yurt%2C%20Kyrgyzstan.jpg",
  tours: "https://commons.wikimedia.org/wiki/Special:FilePath/Kyrgyzstan%20%286052093045%29.jpg",
  food: "https://commons.wikimedia.org/wiki/Special:FilePath/%D0%91%D0%B5%D1%88%D0%B1%D0%B0%D1%80%D0%BC%D0%B0%D0%BA.jpg",
  shop: "https://commons.wikimedia.org/wiki/Special:FilePath/Felt%20toys%20in%20Kyrgyzstan.jpg"
} as const;

const copy = {
  ru: {
    nav: { home: "Главная", services: "Сервисы", roles: "Кабинеты", journey: "Как работает" },
    heroEyebrow: "KÖL · единая экосистема Иссык-Куля",
    heroTitle: "Весь Иссык-Куль в одной яркой платформе",
    heroText: "Жильё, туры, еда, покупки и доставка — единый сервис для путешественника, партнёра, курьера и администратора.",
    heroPrimary: "Посмотреть сервисы",
    heroSecondary: "Показать кабинеты",
    heroCardTitle: "Один аккаунт — весь отдых",
    heroCardText: "Клиент выбирает услугу, оформляет заказ или бронь и видит всё в одном кабинете.",
    servicesEyebrow: "4 направления",
    servicesTitle: "Всё, что нужно гостю Иссык-Куля",
    servicesText: "Каждое направление работает как отдельный продукт, но использует единый аккаунт и операционное ядро KÖL.",
    open: "Открыть сценарий",
    stay: { title: "KÖL Stay", subtitle: "Жильё у озера", text: "Гостевые дома, отели, коттеджи и боз үйлөр. Поиск, даты, гости и бронирование.", price: "от 2 800 KGS / ночь" },
    tours: { title: "KÖL Tours", subtitle: "Туры и впечатления", text: "Катер, конные маршруты, горячие источники, экскурсии и локальные гиды.", price: "от 1 800 KGS" },
    food: { title: "KÖL Food", subtitle: "Кыргызская кухня", text: "Рестораны и кафе, меню, корзина, подготовка заказа и доставка к месту отдыха.", price: "от 280 KGS" },
    shop: { title: "KÖL Shop", subtitle: "Локальные товары", text: "Продукты, товары для пляжа, сувениры и всё нужное для поездки в одной корзине.", price: "от 45 KGS" },
    scenarioTitle: "Интерактивный сценарий",
    scenarioStay: "Выберите даты и гостей — система подготовит бронь к подтверждению.",
    scenarioTours: "Выберите количество участников — система подготовит заявку на тур.",
    scenarioFood: "Добавьте блюда в корзину и покажите путь заказа.",
    scenarioShop: "Добавьте товары в корзину и покажите единое оформление.",
    checkIn: "Заезд",
    checkOut: "Выезд",
    guests: "Гости",
    participants: "Участники",
    qty: "Количество",
    checkAvailability: "Проверить и продолжить",
    addCart: "Добавить в корзину",
    successStay: "Готово: даты и гости выбраны. Бронь подготовлена к подтверждению.",
    successTours: "Готово: заявка на тур подготовлена к подтверждению.",
    successCart: "Позиция добавлена. Корзина обновлена.",
    cart: "Корзина",
    rolesEyebrow: "Единая операционная система",
    rolesTitle: "Четыре кабинета — одна платформа",
    rolesText: "Клиент видит свои заказы, партнёр управляет продажами, курьер выполняет доставку, администратор контролирует весь поток.",
    client: { title: "Клиент", text: "Брони, заказы, избранное, предложения и поддержка.", stats: ["Активные заказы", "Бронирования", "Избранное"] },
    partner: { title: "Партнёр", text: "Каталог, доступность, заказы, брони, доставка и аналитика.", stats: ["Новые заказы", "Активные брони", "Каталог"] },
    courier: { title: "Курьер", text: "Назначения, активный маршрут, история и сообщения о проблемах.", stats: ["Новые доставки", "В работе", "Завершено"] },
    admin: { title: "Администратор", text: "Заказы, бронирования, партнёры, доставка, риски и AI-диспетчер.", stats: ["Заказы", "Брони", "Контроль"] },
    dashboard: "Открыть кабинет",
    rolePreview: "Панель управления",
    journeyEyebrow: "Путь пользователя",
    journeyTitle: "От идеи до результата — внутри KÖL",
    journeySteps: ["Найти услугу", "Выбрать даты или товар", "Создать бронь или заказ", "Получить подтверждение", "Следить в кабинете"],
    principleTitle: "Что делает KÖL сильнее обычного сайта",
    principles: ["Один аккаунт для четырёх направлений", "Единый каталог и операционная модель", "Раздельные роли клиента, партнёра, курьера и администратора", "Цена и доступность подтверждаются сервером", "AI помогает, но не придумывает транзакционные данные"],
    ctaTitle: "KÖL — цифровая экосистема отдыха на Иссык-Куле",
    ctaText: "Один интерфейс для гостя. Один рабочий контур для бизнеса. Один центр управления для команды.",
    ctaButton: "Начать показ заново",
    photoNote: "Фото: Wikimedia Commons; используются тематические изображения Кыргызстана по лицензиям исходных файлов.",
    preview: "Презентационная версия KÖL",
    language: "Язык"
  },
  ky: {
    nav: { home: "Башкы бет", services: "Кызматтар", roles: "Кабинеттер", journey: "Кантип иштейт" },
    heroEyebrow: "KÖL · Ысык-Көлдүн бирдиктүү экосистемасы",
    heroTitle: "Бүтүндөй Ысык-Көл — бир жаркын платформада",
    heroText: "Турак жай, турлар, тамак-аш, сатып алуулар жана жеткирүү — саякатчы, өнөктөш, курьер жана администратор үчүн бирдиктүү сервис.",
    heroPrimary: "Кызматтарды көрүү",
    heroSecondary: "Кабинеттерди көрсөтүү",
    heroCardTitle: "Бир аккаунт — бүтүндөй эс алуу",
    heroCardText: "Кардар кызматты тандайт, заказ же бронь түзөт жана баарын бир кабинеттен көрөт.",
    servicesEyebrow: "4 багыт",
    servicesTitle: "Ысык-Көлдүн коногуна керектүүнүн баары",
    servicesText: "Ар бир багыт өзүнчө продукт сыяктуу иштейт, бирок KÖLдүн бирдиктүү аккаунтун жана операциялык өзөгүн колдонот.",
    open: "Сценарийди ачуу",
    stay: { title: "KÖL Stay", subtitle: "Көл жээгиндеги турак жай", text: "Конок үйлөр, мейманканалар, коттедждер жана боз үйлөр. Издөө, күндөр, коноктор жана брондоо.", price: "2 800 KGS / түндөн" },
    tours: { title: "KÖL Tours", subtitle: "Турлар жана таасирлер", text: "Катер, ат менен сейилдөө, ысык булактар, экскурсиялар жана жергиликтүү гиддер.", price: "1 800 KGS баштап" },
    food: { title: "KÖL Food", subtitle: "Кыргыз ашканасы", text: "Ресторандар жана кафелер, меню, себет, заказды даярдоо жана эс алуу жайына жеткирүү.", price: "280 KGS баштап" },
    shop: { title: "KÖL Shop", subtitle: "Жергиликтүү товарлар", text: "Азык-түлүк, пляжга керектүү буюмдар, сувенирлер жана сапарга керектүүнүн баары бир себетте.", price: "45 KGS баштап" },
    scenarioTitle: "Интерактивдүү сценарий",
    scenarioStay: "Күндөрдү жана коноктордун санын тандаңыз — система бронду ырастоого даярдайт.",
    scenarioTours: "Катышуучулардын санын тандаңыз — система турга өтүнмөнү ырастоого даярдайт.",
    scenarioFood: "Тамактарды себетке кошуп, заказдын жолун көрсөтүңүз.",
    scenarioShop: "Товарларды себетке кошуп, бирдиктүү тариздөөнү көрсөтүңүз.",
    checkIn: "Келүү күнү",
    checkOut: "Чыгуу күнү",
    guests: "Коноктор",
    participants: "Катышуучулар",
    qty: "Саны",
    checkAvailability: "Текшерип улантуу",
    addCart: "Себетке кошуу",
    successStay: "Даяр: күндөр жана коноктор тандалды. Бронь ырастоого даяр.",
    successTours: "Даяр: турга өтүнмө ырастоого даяр.",
    successCart: "Позиция кошулду. Себет жаңыртылды.",
    cart: "Себет",
    rolesEyebrow: "Бирдиктүү операциялык система",
    rolesTitle: "Төрт кабинет — бир платформа",
    rolesText: "Кардар өз заказдарын көрөт, өнөктөш сатууларды башкарат, курьер жеткирүүнү аткарат, администратор бүт агымды көзөмөлдөйт.",
    client: { title: "Кардар", text: "Брондор, заказдар, тандалмалар, сунуштар жана колдоо.", stats: ["Активдүү заказдар", "Брондор", "Тандалмалар"] },
    partner: { title: "Өнөктөш", text: "Каталог, жеткиликтүүлүк, заказдар, брондор, жеткирүү жана аналитика.", stats: ["Жаңы заказдар", "Активдүү брондор", "Каталог"] },
    courier: { title: "Курьер", text: "Тапшырмалар, активдүү маршрут, тарых жана көйгөйлөр тууралуу билдирүүлөр.", stats: ["Жаңы жеткирүүлөр", "Иште", "Аяктады"] },
    admin: { title: "Администратор", text: "Заказдар, брондор, өнөктөштөр, жеткирүү, тобокелдиктер жана AI-диспетчер.", stats: ["Заказдар", "Брондор", "Көзөмөл"] },
    dashboard: "Кабинетти ачуу",
    rolePreview: "Башкаруу панели",
    journeyEyebrow: "Колдонуучунун жолу",
    journeyTitle: "Идеядан жыйынтыкка чейин — KÖL ичинде",
    journeySteps: ["Кызматты табуу", "Күндөрдү же товарды тандоо", "Бронь же заказ түзүү", "Ырастоону алуу", "Кабинеттен көзөмөлдөө"],
    principleTitle: "KÖLдү кадимки сайттан күчтүү кылган нерсе",
    principles: ["Төрт багыт үчүн бир аккаунт", "Бирдиктүү каталог жана операциялык модель", "Кардар, өнөктөш, курьер жана администратор үчүн өзүнчө ролдор", "Баа жана жеткиликтүүлүк сервер тарабынан ырасталат", "AI жардам берет, бирок транзакциялык маалыматтарды ойлоп чыгарбайт"],
    ctaTitle: "KÖL — Ысык-Көлдөгү эс алуунун санариптик экосистемасы",
    ctaText: "Конок үчүн бир интерфейс. Бизнес үчүн бир жумушчу контур. Команда үчүн бир башкаруу борбору.",
    ctaButton: "Көрсөтүүнү башынан баштоо",
    photoNote: "Сүрөттөр: Wikimedia Commons; Кыргызстандын тематикалык сүрөттөрү баштапкы файлдардын лицензиялары боюнча колдонулат.",
    preview: "KÖL презентациялык версиясы",
    language: "Тил"
  }
} as const;

const serviceOrder: ServiceKey[] = ["stay", "tours", "food", "shop"];
const roleOrder: RoleKey[] = ["client", "partner", "courier", "admin"];

export default function PresentationPage() {
  const [language, setLanguage] = useState<Language>("ru");
  const [activeService, setActiveService] = useState<ServiceKey>("stay");
  const [activeRole, setActiveRole] = useState<RoleKey>("client");
  const [cartCount, setCartCount] = useState(0);
  const [status, setStatus] = useState("");
  const t = copy[language];

  const service = useMemo(() => ({
    stay: t.stay,
    tours: t.tours,
    food: t.food,
    shop: t.shop
  }), [t]);

  const role = useMemo(() => ({
    client: t.client,
    partner: t.partner,
    courier: t.courier,
    admin: t.admin
  }), [t]);

  function selectService(key: ServiceKey) {
    setActiveService(key);
    setStatus("");
    document.getElementById("scenario")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function performAction() {
    if (activeService === "food" || activeService === "shop") {
      setCartCount((value) => value + 1);
      setStatus(t.successCart);
      return;
    }

    setStatus(activeService === "stay" ? t.successStay : t.successTours);
  }

  return (
    <main className="min-h-screen bg-[#f6fbff] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/20 bg-[#063d57]/90 text-white shadow-lg backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a className="flex items-center gap-3" href="#home">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-600 text-xl font-black text-white shadow-lg">K</span>
            <div>
              <p className="text-xl font-black tracking-tight">KÖL</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">Issyk-Kul ecosystem</p>
            </div>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-semibold lg:flex">
            <a className="transition hover:text-yellow-300" href="#home">{t.nav.home}</a>
            <a className="transition hover:text-yellow-300" href="#services">{t.nav.services}</a>
            <a className="transition hover:text-yellow-300" href="#roles">{t.nav.roles}</a>
            <a className="transition hover:text-yellow-300" href="#journey">{t.nav.journey}</a>
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/20 bg-white/10 p-1 text-xs font-bold">
              <button className={`rounded-lg px-3 py-2 transition ${language === "ru" ? "bg-white text-[#063d57]" : "text-white hover:bg-white/10"}`} onClick={() => { setLanguage("ru"); setStatus(""); }} type="button">RU</button>
              <button className={`rounded-lg px-3 py-2 transition ${language === "ky" ? "bg-white text-[#063d57]" : "text-white hover:bg-white/10"}`} onClick={() => { setLanguage("ky"); setStatus(""); }} type="button">KG</button>
            </div>
            <div className="hidden rounded-xl bg-yellow-300 px-3 py-2 text-xs font-black text-slate-900 sm:block">{t.cart}: {cartCount}</div>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[760px] overflow-hidden" id="home">
        <img alt="Issyk-Kul" className="absolute inset-0 h-full w-full object-cover" src={images.hero} />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(2,35,55,.94)_10%,rgba(3,87,115,.72)_52%,rgba(0,129,158,.32)_100%)]" />
        <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-yellow-300/30 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />

        <div className="relative mx-auto grid min-h-[760px] max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:px-8">
          <div className="max-w-4xl text-white">
            <div className="inline-flex rounded-full border border-cyan-200/30 bg-cyan-100/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-100 backdrop-blur">{t.heroEyebrow}</div>
            <h1 className="mt-6 text-5xl font-black leading-[.98] tracking-tight sm:text-6xl lg:text-7xl">{t.heroTitle}</h1>
            <p className="mt-6 max-w-3xl text-lg font-medium leading-8 text-white/85 sm:text-xl">{t.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="rounded-2xl bg-yellow-300 px-6 py-4 text-sm font-black text-slate-950 shadow-[0_16px_40px_rgba(253,224,71,.28)] transition hover:-translate-y-1" href="#services">{t.heroPrimary}</a>
              <a className="rounded-2xl border border-white/30 bg-white/10 px-6 py-4 text-sm font-black text-white backdrop-blur transition hover:-translate-y-1 hover:bg-white/20" href="#roles">{t.heroSecondary}</a>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {["Stay", "Tours", "Food", "Shop"].map((label, index) => (
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur" key={label}>
                  <p className="text-2xl font-black text-yellow-300">0{index + 1}</p>
                  <p className="mt-1 text-sm font-bold">KÖL {label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/25 bg-white/12 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
            <div className="overflow-hidden rounded-[1.6rem] bg-white text-slate-950 shadow-xl">
              <img alt="Kyrgyz yurt" className="h-64 w-full object-cover" src={images.stay} />
              <div className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-800">KÖL Stay</span>
                  <span className="text-sm font-black text-emerald-600">★ 4.9</span>
                </div>
                <h2 className="mt-4 text-2xl font-black">{t.heroCardTitle}</h2>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{t.heroCardText}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="rounded-xl bg-sky-50 p-3">Stay</div>
                  <div className="rounded-xl bg-orange-50 p-3">Tours</div>
                  <div className="rounded-xl bg-emerald-50 p-3">Food + Shop</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8" id="services">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[.2em] text-cyan-700">{t.servicesEyebrow}</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{t.servicesTitle}</h2>
          <p className="mt-4 text-base font-medium leading-7 text-slate-600">{t.servicesText}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {serviceOrder.map((key) => {
            const item = service[key];
            const selected = activeService === key;
            return (
              <button className={`group overflow-hidden rounded-[1.7rem] border bg-white text-left shadow-lg transition duration-300 hover:-translate-y-2 hover:shadow-2xl ${selected ? "border-cyan-500 ring-4 ring-cyan-100" : "border-slate-200"}`} key={key} onClick={() => selectService(key)} type="button">
                <div className="relative h-52 overflow-hidden">
                  <img alt={item.subtitle} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={images[key]} />
                  <div className={`absolute inset-0 ${key === "stay" ? "bg-gradient-to-t from-sky-950/80 via-sky-900/10 to-transparent" : key === "tours" ? "bg-gradient-to-t from-orange-950/80 via-orange-900/10 to-transparent" : key === "food" ? "bg-gradient-to-t from-emerald-950/80 via-emerald-900/10 to-transparent" : "bg-gradient-to-t from-fuchsia-950/80 via-fuchsia-900/10 to-transparent"}`} />
                  <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-slate-900">{item.title}</span>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-black">{item.subtitle}</h3>
                  <p className="mt-2 min-h-[72px] text-sm font-medium leading-6 text-slate-600">{item.text}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-cyan-700">{item.price}</span>
                    <span className="text-sm font-black text-slate-950">{t.open} →</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="border-y border-cyan-100 bg-gradient-to-br from-[#e9fbff] via-white to-[#fff8db] py-20" id="scenario">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[.2em] text-cyan-700">{service[activeService].title}</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{t.scenarioTitle}</h2>
            <p className="mt-4 max-w-xl text-base font-medium leading-7 text-slate-600">
              {activeService === "stay" ? t.scenarioStay : activeService === "tours" ? t.scenarioTours : activeService === "food" ? t.scenarioFood : t.scenarioShop}
            </p>
            <div className="mt-7 overflow-hidden rounded-[1.8rem] shadow-2xl">
              <img alt={service[activeService].subtitle} className="h-72 w-full object-cover" src={images[activeService]} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">{service[activeService].title}</p>
                <h3 className="mt-2 text-2xl font-black">{service[activeService].subtitle}</h3>
              </div>
              <div className="rounded-2xl bg-yellow-300 px-4 py-2 text-sm font-black">{activeService === "food" || activeService === "shop" ? `${t.cart}: ${cartCount}` : service[activeService].price}</div>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {activeService === "stay" ? (
                <>
                  <Field label={t.checkIn} type="date" />
                  <Field label={t.checkOut} type="date" />
                  <Field label={t.guests} type="number" wide />
                </>
              ) : activeService === "tours" ? (
                <>
                  <Field label={t.checkIn} type="date" />
                  <Field label={t.participants} type="number" />
                </>
              ) : (
                <>
                  <Field label={t.qty} type="number" />
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">{service[activeService].subtitle}</p>
                    <p className="mt-2 text-xl font-black text-slate-950">{service[activeService].price}</p>
                  </div>
                </>
              )}
            </div>

            <button className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 px-5 py-4 text-sm font-black text-white shadow-xl transition hover:-translate-y-1" onClick={performAction} type="button">
              {activeService === "food" || activeService === "shop" ? t.addCart : t.checkAvailability}
            </button>
            {status ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-800">✓ {status}</div> : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8" id="roles">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[.2em] text-orange-600">{t.rolesEyebrow}</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{t.rolesTitle}</h2>
          <p className="mt-4 text-base font-medium leading-7 text-slate-600">{t.rolesText}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {roleOrder.map((key, index) => (
              <button className={`rounded-2xl border p-5 text-left transition hover:-translate-y-1 ${activeRole === key ? "border-cyan-500 bg-cyan-50 shadow-lg" : "border-slate-200 bg-white hover:border-cyan-300"}`} key={key} onClick={() => setActiveRole(key)} type="button">
                <div className="flex items-start gap-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black text-white ${index === 0 ? "bg-cyan-600" : index === 1 ? "bg-orange-500" : index === 2 ? "bg-emerald-600" : "bg-slate-900"}`}>0{index + 1}</span>
                  <div>
                    <h3 className="text-lg font-black">{role[key].title}</h3>
                    <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{role[key].text}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-[2rem] bg-[#062f46] p-6 text-white shadow-2xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">{t.rolePreview}</p>
                <h3 className="mt-2 text-3xl font-black">KÖL · {role[activeRole].title}</h3>
              </div>
              <span className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-emerald-950">online</span>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              {role[activeRole].stats.map((label, index) => (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-5" key={label}>
                  <p className="text-xs font-bold text-cyan-100">{label}</p>
                  <p className="mt-3 text-3xl font-black text-yellow-300">{index === 0 ? "12" : index === 1 ? "5" : "24"}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[role[activeRole].text, t.principles[0], t.principles[3], t.principles[4]].map((line) => (
                <div className="rounded-2xl bg-white p-4 text-sm font-bold leading-6 text-slate-800" key={line}>{line}</div>
              ))}
            </div>
            <button className="mt-6 rounded-2xl bg-yellow-300 px-5 py-3 text-sm font-black text-slate-950" onClick={() => setStatus(`${t.dashboard}: ${role[activeRole].title}`)} type="button">{t.dashboard}</button>
          </div>
        </div>
      </section>

      <section className="bg-[#061f31] py-20 text-white" id="journey">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-black uppercase tracking-[.2em] text-yellow-300">{t.journeyEyebrow}</p>
          <h2 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">{t.journeyTitle}</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {t.journeySteps.map((step, index) => (
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5" key={step}>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-yellow-300 text-sm font-black text-slate-950">{index + 1}</span>
                <p className="mt-4 text-sm font-bold leading-6">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-[2rem] bg-gradient-to-br from-cyan-500 to-blue-700 p-7 shadow-2xl">
              <h3 className="text-3xl font-black">{t.principleTitle}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {t.principles.map((item) => <div className="rounded-2xl bg-white p-4 text-sm font-bold leading-6 text-slate-800" key={item}>✓ {item}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-r from-yellow-300 via-orange-300 to-rose-300 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <h2 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">{t.ctaTitle}</h2>
            <p className="mt-5 text-lg font-bold leading-8 text-slate-800">{t.ctaText}</p>
            <a className="mt-8 inline-flex rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-xl" href="#home">{t.ctaButton}</a>
          </div>
        </div>
      </section>

      <footer className="bg-[#041723] px-4 py-8 text-white/70">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-xs font-medium sm:flex-row">
          <p>© 2026 KÖL · {t.preview}</p>
          <p className="max-w-3xl text-right">{t.photoNote}</p>
        </div>
      </footer>
    </main>
  );
}

function Field({ label, type, wide = false }: { label: string; type: "date" | "number"; wide?: boolean }) {
  return (
    <label className={`block rounded-2xl bg-slate-50 p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{label}</span>
      <input className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-cyan-500" defaultValue={type === "number" ? 2 : undefined} min={type === "number" ? 1 : undefined} type={type} />
    </label>
  );
}
