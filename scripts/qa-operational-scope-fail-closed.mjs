import fs from "node:fs";

const checks = [
  {
    file: "src/app/admin/delivery/page.tsx",
    required: ["getAdminDeliveryReadResult", "Операционные изменения отключены"],
    forbidden: ["AdminDeliveryDemoActions", "AdminDeliveryControlPanel", "getDeliveryRisk(", "courier demo", "Issue reason demo", "Назначить курьера demo", "Переназначить курьера demo", "Закрыть проблему demo"]
  },
  {
    file: "src/app/admin/ai-dispatcher/page.tsx",
    required: ["AI dispatcher locked", "Event stream", "SLA-конфигурация"],
    forbidden: ["getAIRecommendationsDemo", "getAdminOrders", "AdminAiDispatcherDemoActions", "partner no accept 5 min", "no courier 7 min", "Запустить проверку demo", "Предложить курьера demo"]
  },
  {
    file: "src/app/admin/settings/page.tsx",
    required: ["Settings locked", "Редактирование настроек отключено"],
    forbidden: ["PAYMENTS_ENABLED", "TELEGRAM_ENABLE_REAL_CALLS", "N8N_ENABLE_REAL_CALLS", "Сохранить demo", "@/components/ui/Input", "@/components/ui/Select"]
  },
  {
    file: "src/app/partner/orders/page.tsx",
    required: ["getPartnerOrdersReadResult", "scoped read", "controlled test"],
    forbidden: ["PartnerOrdersDemoActions", "PartnerOrderActions", "PartnerIssueEscalationPanel", "Client demo", "Demo cabinet", "from \"@/lib/data/orders\""]
  },
  {
    file: "src/app/partner/orders/[id]/page.tsx",
    required: ["getPartnerOrdersReadResult", "доступном scope", "Client address/contact"],
    forbidden: ["from \"@/lib/data/orders\"", "generateStaticParams", "getOrderById(", "getPartnerOrders()", "PartnerOrderActions", "PartnerIssueEscalationPanel", "Client demo", "Pickup address demo", "partner pickup point"]
  },
  {
    file: "src/app/partner/delivery/page.tsx",
    required: ["getPartnerOrdersReadResult", "Delivery read-only"],
    forbidden: ["from \"@/lib/data/delivery\"", "from \"@/lib/data/orders\"", "Client demo", "Pickup address demo", "Принять заказ demo", "Сообщить о проблеме demo"]
  },
  {
    file: "src/app/partner/analytics/page.tsx",
    required: ["getPartnerOrdersReadResult", "verified aggregate"],
    forbidden: ["from \"@/lib/data/orders\"", "8.4%", "24%", "const sourceBars", "Delivery delays demo", "['Пн', '55%']"]
  },
  {
    file: "src/app/partner/reviews/page.tsx",
    required: ["Reviews locked", "getPartnerCabinetSummaryReadResult"],
    forbidden: ["Айдана", "Тимур", "Мээрим", "Ответить demo", "Скрыть demo", "from \"@/lib/data/orders\""]
  },
  {
    file: "src/app/partner/stop/page.tsx",
    required: ["Stop controls locked", "Stop/resume actions отключены"],
    forbidden: ["PartnerStopDemoActions", "PartnerStopButtonRulesPanel", "PartnerIssueEscalationPanel", "PartnerStopScopeCard", "Specific item stop demo", "Product stop demo"]
  },
  {
    file: "src/app/client/support/page.tsx",
    required: ["Support locked", "Создание обращений отключено"],
    forbidden: ["const tickets", "Создать обращение demo", "@/components/ui/Input", "@/components/ui/Textarea"]
  },
  {
    file: "src/app/client/profile/page.tsx",
    required: ["Profile locked", "Редактирование профиля отключено"],
    forbidden: ["Айдана", "+996 555", "client@example.com", "Сохранить demo", "@/components/ui/Input", "@/components/ui/Textarea"]
  },
  {
    file: "src/app/client/offers/page.tsx",
    required: ["Offers locked", "Промо-механика ещё не подключена"],
    forbidden: ["discount: \"-10%\"", "discount: \"-15%\"", "discount: \"-200 KGS\"", "Применить demo", "const offers = ["]
  },
  {
    file: "src/app/client/orders/page.tsx",
    required: ["getClientOrdersReadResult", "Повтор заказа, отмена, возврат и оплата не имитируются"],
    forbidden: ["Repeat demo", "Support demo", "Details demo"]
  },
  {
    file: "src/app/partner/availability/page.tsx",
    required: ["getPartnerAvailabilityReadResult", "Availability read-only"],
    forbidden: ["from \"@/lib/data/catalog\"", "const workingHours", "getFood()", "getProducts()", "restaurant working hours demo"]
  },
  {
    file: "src/app/partner/availability/food/page.tsx",
    required: ["getPartnerFoodCatalogReadResult", "Food availability read-only"],
    forbidden: ["from \"@/lib/data/catalog\"", "getFood()", "const workingHours", "PartnerStopScopeCard"]
  },
  {
    file: "src/app/partner/availability/products/page.tsx",
    required: ["getPartnerProductsCatalogReadResult", "Product availability read-only"],
    forbidden: ["from \"@/lib/data/catalog\"", "getProducts()", "const stockDemo", "index ===", "PartnerStopScopeCard"]
  },
  {
    file: "src/app/partner/catalog/food/[id]/page.tsx",
    required: ["getPartnerFoodCatalogReadResult", "Partner-scoped catalog detail"],
    forbidden: ["from \"@/lib/data/catalog\"", "getFoodById(", "generateStaticParams", "Edit demo", "Preparation time demo", "PartnerStopScopeCard"]
  },
  {
    file: "src/app/partner/catalog/products/[id]/page.tsx",
    required: ["getPartnerProductsCatalogReadResult", "Partner-scoped catalog detail"],
    forbidden: ["from \"@/lib/data/catalog\"", "getProductById(", "generateStaticParams", "24 units", "Edit demo", "PartnerStopScopeCard"]
  }
];

const failures = [];
for (const check of checks) {
  const source = fs.readFileSync(check.file, "utf8");
  for (const token of check.required) {
    if (!source.includes(token)) failures.push(`${check.file}: missing required contract token: ${token}`);
  }
  for (const token of check.forbidden) {
    if (source.includes(token)) failures.push(`${check.file}: forbidden operational/demo token present: ${token}`);
  }
}

if (failures.length) {
  console.error("Operational scope fail-closed audit FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Operational scope fail-closed audit PASS");
