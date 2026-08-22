import fs from "node:fs";

const checks = [
  {
    file: "src/app/admin/delivery/page.tsx",
    required: ["getAdminDeliveryReadResult", "Операционные изменения отключены"],
    forbidden: [
      "AdminDeliveryDemoActions",
      "AdminDeliveryControlPanel",
      "getDeliveryRisk(",
      "courier demo",
      "Issue reason demo",
      "Назначить курьера demo",
      "Переназначить курьера demo",
      "Закрыть проблему demo"
    ]
  },
  {
    file: "src/app/admin/ai-dispatcher/page.tsx",
    required: ["AI dispatcher locked", "Event stream", "SLA-конфигурация"],
    forbidden: [
      "getAIRecommendationsDemo",
      "getAdminOrders",
      "AdminAiDispatcherDemoActions",
      "partner no accept 5 min",
      "no courier 7 min",
      "Запустить проверку demo",
      "Предложить курьера demo"
    ]
  },
  {
    file: "src/app/partner/orders/page.tsx",
    required: ["getPartnerOrdersReadResult", "scoped read", "controlled test"],
    forbidden: [
      "PartnerOrdersDemoActions",
      "PartnerOrderActions",
      "PartnerIssueEscalationPanel",
      "Client demo",
      "Demo cabinet",
      "@/lib/data/orders"
    ]
  },
  {
    file: "src/app/partner/orders/[id]/page.tsx",
    required: ["getPartnerOrdersReadResult", "available scope", "Client address/contact"],
    forbidden: [
      "@/lib/data/orders",
      "generateStaticParams",
      "getOrderById",
      "getPartnerOrders",
      "PartnerOrderActions",
      "PartnerIssueEscalationPanel",
      "Client demo",
      "Pickup address demo",
      "partner pickup point"
    ]
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
