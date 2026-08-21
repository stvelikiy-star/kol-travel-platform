import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type ReadOnlyAction = {
  label: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
};

type ReadOnlyActionPanelProps = {
  title: string;
  description: string;
  actions: ReadOnlyAction[];
  note?: string;
};

export function ReadOnlyActionPanel({ title, description, actions, note }: ReadOnlyActionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm leading-6 text-foreground">
          {note ?? "Режим просмотра: действие станет доступно после подключения подтверждённого серверного обработчика, проверки роли и записи в audit log. Интерфейс не имитирует изменение реальных данных."}
        </div>
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <Button key={action.label} variant={action.variant ?? "outline"}>
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
