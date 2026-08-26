import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const decisionFields = [
  ["Ситуация", "Кратко объясняет, что произошло и почему это важно."],
  ["Уровень риска", "Помогает команде расставить приоритеты."],
  ["Рекомендация", "Предлагает следующий безопасный шаг."],
  ["Кого уведомить", "Маршрутизирует событие нужной рабочей роли."],
  ["Нужно подтверждение", "Отмечает действия, которые нельзя выполнять без человека."],
  ["Основание", "Ссылается на реальные события и данные KÖL."]
];

const scenarios = [
  {
    title: "Бронирования",
    text: "Подсветить зависшую бронь, конфликт статусов или ситуацию, требующую внимания администратора."
  },
  {
    title: "Заказы и доставка",
    text: "Обнаружить задержку, проблемный переход статуса или необходимость связаться с партнёром или курьером."
  },
  {
    title: "Партнёры",
    text: "Собрать сигналы по доступности, операционным отклонениям и повторяющимся проблемам бизнеса."
  },
  {
    title: "Сводка собственнику",
    text: "Сжать подтверждённые события в понятную картину: что происходит, где риск и что требует решения человека."
  }
];

export default function AdminAiDispatcherPage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-950 via-primary to-accent p-6 text-white sm:p-8">
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/30 bg-white text-primary">KÖL AI Operations</Badge>
            <Badge className="border-cyan-200/30 bg-cyan-200/15 text-cyan-50">Human-in-the-loop</Badge>
          </div>
          <h2 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl">AI-диспетчер для операционной команды</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/85 sm:text-base">
            AI анализирует только подтверждённые события KÖL, помогает находить отклонения, объясняет риск и рекомендует следующий шаг. Финансовые и другие критические действия остаются под контролем человека и серверных правил.
          </p>
        </div>
      </Card>

      <Card className="border-warning/35 bg-warning/10">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">Статус интеграции</Badge>
            <CardTitle>Рабочий event stream ещё не подключён</CardTitle>
          </div>
          <CardDescription className="leading-6">
            Поэтому KÖL не показывает придуманные тревоги, задержки или назначения. Экран демонстрирует утверждённый продуктовый контур AI без имитации production-операций.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <Card key={scenario.title}>
            <CardHeader>
              <CardTitle>{scenario.title}</CardTitle>
              <CardDescription className="leading-6">{scenario.text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Как принимается AI-рекомендация</CardTitle>
            <CardDescription>Структурированный ответ вместо свободной фантазии модели.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {decisionFields.map(([title, text]) => (
              <div className="rounded-xl border border-border bg-background p-4" key={title}>
                <p className="font-semibold text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Что нужно для рабочего включения</CardTitle>
            <CardDescription>Только проверяемые источники и контролируемые действия.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Реальные timestamped events для заказов, броней, доставки, партнёров и курьеров.</Requirement>
            <Requirement>Версионируемые SLA и правила эскалации, а не числа, зашитые в интерфейсе.</Requirement>
            <Requirement>Детерминированные правила для критических переходов статусов и дедлайнов.</Requirement>
            <Requirement>Серверные actions с проверкой роли и журналированием операционных изменений.</Requirement>
            <Requirement>Явное подтверждение человека для high-risk и финансово значимых действий.</Requirement>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/25 bg-lake-light">
        <CardHeader>
          <CardTitle>Границы, которые AI не может перейти</CardTitle>
          <CardDescription>Эти ограничения остаются частью продукта и после подключения backend.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-3">
          <Requirement>Не придумывает цену, availability, ETA, payment status или состояние доставки.</Requirement>
          <Requirement>Не отменяет заказ и не выполняет финансово значимое действие без разрешённого server workflow.</Requirement>
          <Requirement>Не подменяет бизнес-правила: критическая логика остаётся детерминированной и проверяемой.</Requirement>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-surface p-3 font-medium leading-6 text-foreground">{children}</div>;
}
