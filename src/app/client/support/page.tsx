import type { ReactNode } from "react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const tickets = [
  { id: "ticket-001", title: "Уточнить время доставки", category: "Заказ", priority: "medium", status: "open" },
  { id: "ticket-002", title: "Изменить дату тура", category: "Бронь", priority: "high", status: "pending" }
];

const questions = [
  "Как отменить заказ?",
  "Когда начисляются баллы?",
  "Можно ли изменить даты брони?",
  "Как связаться с партнёром?"
];

export default function ClientSupportPage() {
  return (
    <ClientLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="info">Support</Badge>
          <CardTitle className="text-2xl">Поддержка</CardTitle>
          <CardDescription>Demo support center для вопросов по заказам, броням, баллам и профилю.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium">Real support CRM later. Сейчас обращения не отправляются в backend, Telegram или n8n.</CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Мои обращения</CardTitle>
            <CardDescription>Demo support tickets без реальной отправки.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.map((ticket) => (
              <div className="rounded-lg border border-border bg-background p-4" key={ticket.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{ticket.title}</p>
                    <p className="text-sm text-muted">{ticket.category} · {ticket.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={ticket.priority === "high" ? "warning" : "info"}>{ticket.priority}</Badge>
                    <Badge variant={ticket.status === "open" ? "info" : "warning"}>{ticket.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Создать обращение</CardTitle>
            <CardDescription>Форма пока UI-only, но выглядит как будущая CRM-заявка.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Тема"><Input placeholder="Например: вопрос по заказу" /></Field>
            <Field label="Категория">
              <Select defaultValue="order">
                <option value="order">Заказ</option>
                <option value="booking">Бронь</option>
                <option value="loyalty">Баллы и скидки</option>
                <option value="profile">Профиль</option>
              </Select>
            </Field>
            <Field label="Приоритет demo">
              <Select defaultValue="medium">
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </Select>
            </Field>
            <Field label="Сообщение"><Textarea placeholder="Опишите ситуацию..." /></Field>
          </CardContent>
          <CardFooter>
            <Button>Создать обращение demo</Button>
          </CardFooter>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Быстрые вопросы</CardTitle>
          <CardDescription>Подсказки для будущей базы знаний.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {questions.map((question) => (
            <Button className="h-auto justify-start whitespace-normal bg-background p-3 text-left text-foreground" key={question} variant="outline">
              {question}
            </Button>
          ))}
        </CardContent>
      </Card>
    </ClientLayout>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="space-y-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
