import type { ReactNode } from "react";
import { CourierLayout } from "@/components/layout/CourierLayout";
import { CourierOperationalFinalPanel } from "@/app/courier/_components/CourierOperationalFinalPanel";
import { CourierIssueEscalationPanel } from "@/app/courier/_components/CourierIssueEscalationPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export default function CourierProfilePage() {
  return (
    <CourierLayout status="online">
      <CourierOperationalFinalPanel context="profile" />
      <CourierIssueEscalationPanel context="profile" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier profile</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Профиль курьера</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo профиль курьера без реальной авторизации, документов и геолокации.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo courier cabinet. Реальная авторизация, проверка документов, смены и GPS будут подключены позже.
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Данные курьера</CardTitle>
              <CardDescription>Styled demo form. Данные не сохраняются.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <Input defaultValue="Demo Courier" />
              </Field>
              <Field label="Phone">
                <Input defaultValue="+996 700 555 000" />
              </Field>
              <Field label="Vehicle type">
                <Select defaultValue="car">
                  <option value="car">car</option>
                  <option value="bike">bike</option>
                  <option value="scooter">scooter</option>
                  <option value="walking">walking</option>
                </Select>
              </Field>
              <Field label="Vehicle number demo">
                <Input defaultValue="KOL 0808" />
              </Field>
              <Field label="Working zone">
                <Select defaultValue="cholpon-ata">
                  <option value="cholpon-ata">Чолпон-Ата</option>
                  <option value="bosteri">Бостери</option>
                  <option value="karakol">Каракол</option>
                  <option value="tamchy">Тамчы</option>
                </Select>
              </Field>
              <Field label="Language">
                <Select defaultValue="ru">
                  <option value="ru">Русский</option>
                  <option value="kg">Кыргызча demo</option>
                  <option value="en">English demo</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select defaultValue="online">
                  <option value="online">online</option>
                  <option value="busy">busy</option>
                  <option value="paused">paused</option>
                  <option value="offline">offline</option>
                </Select>
              </Field>
              <Field label="Comment">
                <Textarea defaultValue="Demo courier profile note." />
              </Field>
            </CardContent>
            <CardFooter>
              <Button>Сохранить demo</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shift settings demo</CardTitle>
              <CardDescription>Смены будут связаны с реальным расписанием позже.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field label="Start">
                <Input defaultValue="09:00" />
              </Field>
              <Field label="End">
                <Input defaultValue="21:00" />
              </Field>
              <Field label="Break">
                <Input defaultValue="14:00 - 15:00" />
              </Field>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Notification preferences demo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["Новые назначения", "Задержки", "Проблемы", "Доход"].map((item) => (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3" key={item}>
                  <span className="text-sm font-medium text-foreground">{item}</span>
                  <Badge variant="success">on</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-warning/40 bg-warning/10">
            <CardHeader>
              <CardTitle>Safety rules</CardTitle>
              <CardDescription>Курьер не меняет оплату, состав заказа, юридические статусы и alcohol delivery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                "Не менять payment status",
                "Не отменять заказ без админа",
                "Не включать alcohol delivery",
                "Эскалировать high-risk проблемы админу"
              ].map((rule) => (
                <div className="rounded-md border border-border bg-surface p-3 text-sm font-medium text-foreground" key={rule}>
                  {rule}
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </section>
    </CourierLayout>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      {label}
      {children}
    </label>
  );
}
