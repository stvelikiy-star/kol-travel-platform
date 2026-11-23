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
      description="ИИ-диспетчер может готовить рекомендации и сигналы, но не выполняет операции повышенного риска без серверного контроля и подтверждения человеком."
      note="Режим просмотра: рекомендации не меняют заказ, оплату, доставку или статус партнёра. Для исполнения необходимы серверная проверка, журнал действий и подтверждение человеком там, где этого требуют правила безопасности."
      title="AI-диспетчер"
    />
  );
}
