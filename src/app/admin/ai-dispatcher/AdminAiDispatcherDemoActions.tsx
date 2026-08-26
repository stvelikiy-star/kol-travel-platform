import { ReadOnlyActionPanel } from "@/components/operations/ReadOnlyActionPanel";

export function AdminAiDispatcherDemoActions() {
  return (
    <ReadOnlyActionPanel
      actions={[
        { label: "Рекомендовать курьера", variant: "primary" },
        { label: "Рекомендовать переназначение", variant: "outline" },
        { label: "Создать предупреждение о задержке", variant: "outline" },
        { label: "Записать решение AI", variant: "secondary" },
        { label: "Записать отказ по безопасности", variant: "danger" }
      ]}
      description="AI-диспетчер может готовить рекомендации и сигналы, но не исполняет high-risk операции без серверного контроля и человеческого подтверждения."
      note="Режим просмотра: рекомендации не меняют заказ, оплату, доставку или статус партнёра. Исполнение требует backend-проверки, audit log и human approval там, где это предусмотрено правилами безопасности."
      title="AI-диспетчер"
    />
  );
}
