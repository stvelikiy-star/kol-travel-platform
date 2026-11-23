/* КӨЛ — пакет сезона: ЗИМА. Летняя версия = такой же файл season-summer.js
   (тексты подборок, поля поиска, быстрые вопросы консьержа, картинки). Все данные демонстрационные. */
window.KOL_SEASON = {
  id: 'winter',
  label: 'Зима',
  directions: {
    stay:     { title: 'Проживание', icon: 'stay',     card: 'Название отеля',   note: 'Описание появится после подключения партнёров',
                images: ['stay', 'lake', 'hero'],  chip: 'Где остановиться зимой' },
    tours:    { title: 'Туры',       icon: 'tours',    card: 'Название маршрута', note: 'Длительность и условия не указаны',
                images: ['tours', 'lake', 'hero'], chip: 'Что посмотреть зимой' },
    delivery: { title: 'Доставка',   icon: 'delivery', card: 'Название партнёра', note: 'Меню и время доставки не указаны',
                images: ['delivery', 'stay', 'lake'], chip: 'Заказать доставку' },
    transfer: { title: 'Трансфер',   icon: 'transfer', card: 'Название сервиса',  note: 'Маршруты и условия не указаны',
                images: ['transfer', 'hero', 'lake'], chip: 'Нужен трансфер' }
  },
  // поля поиска по направлениям: до трёх слотов
  search: {
    stay:     [ {label:'Куда',            type:'text',   ph:'Город или место на Иссык-Куле'},
                {label:'Даты заезда',     type:'date'},
                {label:'Гости',           type:'select', options:['1 гость','2 гостя','3 гостя','4 гостя','5 и больше']} ],
    tours:    [ {label:'Что посмотреть',  type:'text',   ph:'Маршрут или впечатление'},
                {label:'Дата',            type:'date'},
                {label:'Участники',       type:'select', options:['1 человек','2 человека','3 человека','4 человека','5 и больше']} ],
    delivery: [ {label:'Адрес доставки',  type:'text',   ph:'Улица, дом или название отеля', required:true, error:'Укажите адрес доставки.'},
                {label:'Что заказать',    type:'select', options:['Еда','Магазин','Сувениры','Для отдыха']},
                null ],
    transfer: [ {label:'Откуда',          type:'text',   ph:'Город, аэропорт или отель'},
                {label:'Куда',            type:'text',   ph:'Город, место или отель'},
                {label:'Дата',            type:'date'} ]
  },
  concierge: {
    greeting: 'Здравствуйте! Помогу выбрать, где остановиться, что посмотреть, заказать доставку или трансфер на зимнем Иссык-Куле. Это демо-режим: ИИ и данные об услугах пока не подключены.',
    answers: {
      stay:     'Демо-режим: настоящих данных об отелях пока нет. В подборке «Проживание» будут карточки партнёров, когда они подключатся.',
      tours:    'Демо-режим: списка зимних туров пока нет. В подборке «Туры» появятся маршруты партнёров.',
      delivery: 'Демо-режим: заказы не принимаются. В подборке «Доставка» будут партнёры с едой и товарами.',
      transfer: 'Демо-режим: поездки не оформляются. В подборке «Трансфер» будут сервисы такси и встречи.'
    },
    empty: 'Демо-режим: свободные вопросы пока не обрабатываются. Выберите один из вариантов ниже.'
  }
};

/* ---------- Каталог демо-карточек, категории доставки, поля заявки (все данные демонстрационные) ---------- */
(function (S) {
  S.deliveryCats = [
    { id: 'food', label: 'Еда' }, { id: 'shop', label: 'Магазин' },
    { id: 'gift', label: 'Сувениры' }, { id: 'rest', label: 'Для отдыха' }
  ];
  S.pages = {
    stay:     { lead: 'Отели, гостевые дома и коттеджи на зимнем Иссык-Куле. Выберите даты и количество гостей.', hero: 'stay' },
    tours:    { lead: 'Маршруты и зимние впечатления у озера и в горах. Выберите дату и количество участников.', hero: 'tours' },
    delivery: { lead: 'Еда и товары к вашему адресу: рестораны, магазины, сувениры и всё для отдыха.', hero: 'delivery' },
    transfer: { lead: 'Такси и встреча: аэропорт, города побережья, отели. Укажите маршрут и дату.', hero: 'transfer' }
  };
  S.catalog = {};
  Object.keys(S.directions).forEach(function (d) {
    var D = S.directions[d], cats = S.deliveryCats;
    S.catalog[d] = [0, 1, 2, 3, 4, 5].map(function (i) {
      return { id: i, title: D.card + ' ' + (i + 1), note: D.note, img: D.images[i % D.images.length], cat: d === 'delivery' ? cats[i % cats.length].id : null };
    });
  });
  S.request = {
    stay: [ { id: 'from', label: 'Дата заезда', type: 'date' }, { id: 'to', label: 'Дата выезда', type: 'date' },
            { id: 'guests', label: 'Гости', type: 'select', options: ['1 гость', '2 гостя', '3 гостя', '4 гостя', '5 и больше'] } ],
    tours: [ { id: 'date', label: 'Дата', type: 'date' },
             { id: 'people', label: 'Участники', type: 'select', options: ['1 человек', '2 человека', '3 человека', '4 человека', '5 и больше'] } ],
    delivery: [ { id: 'addr', label: 'Адрес доставки', type: 'text', ph: 'Улица, дом или название отеля', required: true, error: 'Укажите адрес доставки.' },
                { id: 'what', label: 'Что заказать', type: 'select', options: ['Еда', 'Магазин', 'Сувениры', 'Для отдыха'] } ],
    transfer: [ { id: 'a', label: 'Откуда', type: 'text', ph: 'Город, аэропорт или отель', required: true, error: 'Укажите, откуда ехать.' },
                { id: 'b', label: 'Куда', type: 'text', ph: 'Город, место или отель', required: true, error: 'Укажите, куда ехать.' },
                { id: 'date', label: 'Дата', type: 'date' },
                { id: 'pax', label: 'Пассажиры', type: 'select', options: ['1 пассажир', '2 пассажира', '3 пассажира', '4 пассажира', '5 и больше'] } ]
  };
  S.concierge.pages = { stay: 'stay.html', tours: 'tours.html', delivery: 'delivery.html', transfer: 'transfer.html' };
})(window.KOL_SEASON);

/* ---------- Сцены первого экрана (данные: заголовок по строкам, описание, изображение, акцент, CTA, ссылка) ---------- */
window.KOL_SEASON.scenes = [
  { id: 'stay', label: 'Проживание', short: 'Отели', lines: ['Просыпайтесь', 'у Иссык-Куля'],
    lead: 'Отели, гостевые дома и коттеджи на зимнем берегу. Выберите даты и гостей и оставьте заявку.',
    img: 'scene-stay', pos: '52% 52%', shape: 'arch', accent: '#18D8C4', soft: '#D9F7F3', deep: '#0A6C86',
    link: 'Найти по датам', cta: 'Выбрать проживание', href: '/stays', icon: 'stay',
    steps: [['calendar', 'Даты заезда'], ['guests', 'Количество гостей'], ['check', 'Заявка партнёру']] },
  { id: 'tours', label: 'Туры', short: 'Туры', lines: ['Откройте', 'больше, чем', 'берег'],
    lead: 'Маршруты по озеру и горам. Выберите дату и количество участников и оставьте заявку.',
    img: 'scene-tours', pos: '52% 48%', shape: 'pebble', accent: '#087EA4', soft: '#D8EBF3', deep: '#063B57',
    link: 'Найти по дате', cta: 'Посмотреть туры', href: '/tours', icon: 'tours',
    steps: [['route', 'Маршрут'], ['calendar', 'Дата'], ['guests', 'Участники']] },
  { id: 'delivery', label: 'Доставка', short: 'Доставка', lines: ['Вкусный отдых.', 'Всё рядом.'],
    lead: 'Еда и товары к вашему адресу: рестораны, магазины, сувениры. Выберите категорию и укажите адрес.',
    img: 'scene-delivery', pos: '55% 54%', shape: 'round', accent: '#F2A25C', soft: '#FBE9D8', deep: '#8A4A12',
    link: 'Указать адрес', cta: 'Открыть доставку', href: '/delivery', icon: 'delivery',
    steps: [['pin', 'Адрес доставки'], ['shop', 'Категория'], ['check', 'Заявка партнёру']] },
  { id: 'transfer', label: 'Трансфер', short: 'Трансфер', lines: ['Ваш отдых', 'начинается', 'с дороги'],
    lead: 'Такси и встреча: аэропорт, города побережья, отели. Укажите маршрут и дату.',
    img: 'scene-transfer', pos: '47% 54%', shape: 'ticket', accent: '#6FA3BF', soft: '#E3ECF1', deep: '#063B57',
    link: 'Указать маршрут', cta: 'Выбрать трансфер', href: '/transfer', icon: 'transfer',
    steps: [['pin', 'Откуда и куда'], ['calendar', 'Дата'], ['guests', 'Пассажиры']] }
];