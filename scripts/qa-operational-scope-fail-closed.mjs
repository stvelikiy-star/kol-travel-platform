import fs from "node:fs";

const checks = [
  {
    file: "src/app/admin/delivery/page.tsx",
    required: ["getAdminDeliveryReadResult", "Операционные действия защищены"],
    forbidden: ["AdminDeliveryDemoActions", "AdminDeliveryControlPanel", "getDeliveryRisk(", "courier demo", "Issue reason demo", "Назначить курьера demo", "Переназначить курьера demo", "Закрыть проблему demo"]
  },
  {
    file: "src/app/admin/ai-dispatcher/page.tsx",
    required: ["Рабочий event stream ещё не подключён", "Версионируемые SLA", "Human-in-the-loop"],
    forbidden: ["getAIRecommendationsDemo", "getAdminOrders", "AdminAiDispatcherDemoActions", "partner no accept 5 min", "no courier 7 min", "Запустить проверку demo", "Предложить курьера demo"]
  },
  {
    file: "src/app/admin/settings/page.tsx",
    required: ["Settings locked", "Редактирование настроек отключено"],
    forbidden: ["PAYMENTS_ENABLED", "TELEGRAM_ENABLE_REAL_CALLS", "N8N_ENABLE_REAL_CALLS", "Сохранить demo", "@/components/ui/Input", "@/components/ui/Select"]
  },
  {
    file: "src/app/partner/orders/page.tsx",
    required: [
      "getPartnerOrdersReadResult",
      "Food/Shop заказы текущего бизнеса",
      "защищённый атомарный контур",
      "Courier dispatch включается только",
      "PartnerOrderActions"
    ],
    forbidden: [
      "PartnerOrdersDemoActions",
      "PartnerIssueEscalationPanel",
      "Client demo",
      "Demo cabinet",
      "from \"@/lib/data/orders\"",
      "realReadyForPickupPilotOrderId",
      "runReadyForPickupRealPilot",
      "readyPickupPilot",
      "DemoActionResultPanel",
      "partnerOrdersReal",
      "markOrderReadyForPickupAction"
    ]
  },
  {
    file: "src/app/partner/orders/[id]/page.tsx",
    required: [
      "getPartnerOrdersReadResult",
      "доступном scope",
      "client contact/address",
      "PartnerOrderActions",
      "Запрос отмены и issue — audit-only",
      "Courier dispatch не создаётся для pickup order"
    ],
    forbidden: [
      "from \"@/lib/data/orders\"",
      "generateStaticParams",
      "getOrderById(",
      "getPartnerOrders()",
      "PartnerIssueEscalationPanel",
      "Client demo",
      "Pickup address demo",
      "partner pickup point",
      "readyPickupPilot",
      "DemoActionResultPanel",
      "partnerOrdersReal",
      "markOrderReadyForPickupAction"
    ]
  },
  {
    file: "src/components/partner/PartnerOrderActions.tsx",
    required: [
      "partnerOrderFormAction",
      "partner-order-${randomUUID()}",
      "request_cancellation",
      "Shop-заказа заблокировано",
      "atomic restock contract"
    ],
    forbidden: [
      "acceptPartnerOrderDemoAction",
      "rejectPartnerOrderDemoAction",
      "markOrderPreparingDemoAction",
      "markOrderReadyForPickupDemoAction",
      "reportPartnerOrderIssueDemoAction",
      "requestAcceptedOrderCancellationDemoAction",
      "demo actions",
      "demo</Button>"
    ]
  },
  {
    file: "src/app/actions/partner/partnerOrders.ts",
    required: [
      "\"use server\"",
      "requirePartner",
      "partner_order_action_atomic",
      "requestId.length < 8",
      "reason.length > 500",
      "revalidatePath(\"/partner/orders\")"
    ],
    forbidden: [
      "createDemoActionResult",
      "acceptPartnerOrderDemoAction",
      "markOrderReadyForPickupDemoAction",
      "DemoActionResult"
    ]
  },
  {
    file: "supabase/schema/015_partner_order_lifecycle_DRAFT_NOT_APPLIED.sql",
    required: [
      "private.partner_order_action_atomic_internal",
      "security definer",
      "set search_path = ''",
      "auth.uid()",
      "order_not_available_for_partner",
      "shop_reject_restock_contract_required",
      "paid_order_rejection_requires_admin_policy",
      "security invoker",
      "revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from authenticated",
      "grant execute on function public.partner_order_action_atomic(uuid,text,text,text) to authenticated"
    ],
    forbidden: [
      "grant execute on function public.partner_order_action_atomic(uuid,text,text,text) to anon",
      "delivery_fee =",
      "payment_status = 'paid'",
      "payment_status = 'refunded'"
    ]
  },
  {
    file: "src/app/partner/delivery/page.tsx",
    required: ["getPartnerOrdersReadResult", "Действия с доставкой защищены"],
    forbidden: ["from \"@/lib/data/delivery\"", "from \"@/lib/data/orders\"", "Client demo", "Pickup address demo", "Принять заказ demo", "Сообщить о проблеме demo"]
  },
  {
    file: "src/app/partner/analytics/page.tsx",
    required: ["getPartnerOrdersReadResult", "verified aggregate"],
    forbidden: ["from \"@/lib/data/orders\"", "8.4%", "24%", "const sourceBars", "Delivery delays demo", "['Пн', '55%']"]
  },
  {
    file: "src/app/partner/reviews/page.tsx",
    required: ["источник отзывов не подключён", "getPartnerCabinetSummaryReadResult"],
    forbidden: ["Айдана", "Тимур", "Мээрим", "Ответить demo", "Скрыть demo", "from \"@/lib/data/orders\""]
  },
  {
    file: "src/app/partner/stop/page.tsx",
    required: ["Stop controls locked", "Stop/resume actions отключены"],
    forbidden: ["PartnerStopDemoActions", "PartnerStopButtonRulesPanel", "PartnerIssueEscalationPanel", "PartnerStopScopeCard", "Specific item stop demo", "Product stop demo"]
  },
  {
    file: "src/app/client/support/page.tsx",
    required: ["Отправка обращений пока недоступна", "не создаёт вымышленные заявки и статусы"],
    forbidden: ["const tickets", "Создать обращение demo", "@/components/ui/Input", "@/components/ui/Textarea"]
  },
  {
    file: "src/app/client/profile/page.tsx",
    required: ["Редактирование профиля пока недоступно", "не подставляет вымышленные имя, телефон, email"],
    forbidden: ["Айдана", "+996 555", "client@example.com", "Сохранить demo", "@/components/ui/Input", "@/components/ui/Textarea"]
  },
  {
    file: "src/app/client/offers/page.tsx",
    required: ["Offers locked", "Промо-механика ещё не подключена"],
    forbidden: ["discount: \"-10%\"", "discount: \"-15%\"", "discount: \"-200 KGS\"", "Применить demo", "const offers = ["]
  },
  {
    file: "src/app/client/orders/page.tsx",
    required: ["getClientOrdersReadResult", "Повтор заказа, отмена, возврат и оплата не запускаются простой загрузкой страницы"],
    forbidden: ["Repeat demo", "Support demo", "Details demo"]
  },
  {
    file: "src/app/partner/availability/page.tsx",
    required: ["getPartnerAvailabilityReadResult", "Изменения доступности защищены"],
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
