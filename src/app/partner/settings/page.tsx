import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { PartnerStopButtonRulesPanel } from "@/app/partner/stop/_components/PartnerStopButtonRulesPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { mockPartners } from "@/data/mockPartners";

const partner = mockPartners[0];

export default function PartnerSettingsPage() {
  return (
    <PartnerLayout>
      <PartnerIssueEscalationPanel context="settings" />
      <PartnerStopButtonRulesPanel />

      <section className="space-y-6">
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-5">
          <Badge variant="info">Demo settings</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Настройки партнёра</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Настройки пока не сохраняются. Реальная авторизация, роли сотрудников и
            модерация изменений будут подключены позже.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Информация о партнёре</CardTitle>
                <CardDescription>Публичные данные бизнеса в KÖL.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Название">
                  <Input defaultValue={partner?.title ?? "Demo Partner"} />
                </Field>
                <Field label="Тип партнёра">
                  <Select defaultValue={partner?.type ?? "restaurant"}>
                    <option value="hotel">Отель</option>
                    <option value="guest_house">Гостевой дом</option>
                    <option value="restaurant">Ресторан</option>
                    <option value="cafe">Кафе</option>
                    <option value="shop">Магазин</option>
                    <option value="tour_operator">Туроператор</option>
                    <option value="guide">Гид</option>
                  </Select>
                </Field>
                <Field label="Телефон">
                  <Input defaultValue="+996 700 000 000" />
                </Field>
                <Field label="Email">
                  <Input defaultValue="partner@kol.demo" />
                </Field>
                <Field label="Адрес">
                  <Input defaultValue={partner?.location ?? "Чолпон-Ата"} />
                </Field>
                <Field label="Описание">
                  <Textarea
                    className="min-h-28"
                    defaultValue={partner?.description ?? "Demo описание партнёра для marketplace KÖL."}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Рабочие часы</CardTitle>
                <CardDescription>Demo расписание для заказов и бронирований.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <Field label="Понедельник - пятница">
                  <Input defaultValue="09:00 - 22:00" />
                </Field>
                <Field label="Суббота">
                  <Input defaultValue="10:00 - 23:00" />
                </Field>
                <Field label="Воскресенье">
                  <Input defaultValue="10:00 - 21:00" />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Правила бронирования</CardTitle>
                <CardDescription>Будут связаны с календарём доступности позже.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Подтверждение">
                  <Select defaultValue="manual">
                    <option value="manual">Ручное подтверждение</option>
                    <option value="instant">Мгновенное подтверждение demo</option>
                  </Select>
                </Field>
                <Field label="Правила отмены">
                  <Input defaultValue="Через поддержку, по правилам партнёра" />
                </Field>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Доставка demo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Доставка">
                  <Select defaultValue="enabled">
                    <option value="enabled">Включена demo</option>
                    <option value="paused">Пауза demo</option>
                    <option value="disabled">Отключена demo</option>
                  </Select>
                </Field>
                <Field label="Адрес выдачи">
                  <Input defaultValue="Чолпон-Ата, главная точка выдачи" />
                </Field>
                <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-muted">
                  Курьерами управляют AI-диспетчер и админ KÖL. Партнёр отмечает только готовность к выдаче.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Доступ сотрудников</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["Owner demo", "Manager demo", "Finance demo"].map((staff) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
                    key={staff}
                  >
                    <span className="text-sm font-semibold text-foreground">{staff}</span>
                    <Badge variant="muted">demo</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Уведомления</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["Новые заказы", "Новые брони", "Отзывы", "Финансы"].map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
                    key={item}
                  >
                    <span className="text-sm font-medium text-foreground">{item}</span>
                    <Badge variant="success">on</Badge>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button className="w-full">Сохранить demo</Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>
    </PartnerLayout>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      {label}
      {children}
    </label>
  );
}
