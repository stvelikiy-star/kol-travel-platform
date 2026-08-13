import type { ReactNode } from "react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export default function ClientProfilePage() {
  return (
    <ClientLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="info">Profile</Badge>
          <CardTitle className="text-2xl">Профиль</CardTitle>
          <CardDescription>Demo profile form. После auth здесь будут реальные личные данные клиента.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium">Real auth/profile later. Сейчас форма не сохраняет данные.</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Данные клиента</CardTitle>
          <CardDescription>Контакты нужны для заказов, броней, уведомлений и поддержки.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Имя"><Input defaultValue="Айдана" /></Field>
          <Field label="Телефон"><Input defaultValue="+996 555 000 000" /></Field>
          <Field label="Email"><Input defaultValue="client@example.com" type="email" /></Field>
          <Field label="Язык">
            <Select defaultValue="ru">
              <option value="ru">Русский</option>
              <option value="ky">Кыргызский</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field className="md:col-span-2" label="Адреса доставки">
            <Textarea defaultValue={"Чолпон-Ата, район центрального пляжа\nБостери, рядом с пансионатом"} />
          </Field>
          <Field label="Уведомления">
            <Select defaultValue="all">
              <option value="all">Заказы, брони и акции</option>
              <option value="orders">Только заказы и брони</option>
              <option value="off">Выключены в demo</option>
            </Select>
          </Field>
          <Field label="Канал связи">
            <Select defaultValue="telegram">
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Телефон</option>
            </Select>
          </Field>
        </CardContent>
        <CardFooter>
          <Button>Сохранить demo</Button>
        </CardFooter>
      </Card>
    </ClientLayout>
  );
}

function Field({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <label className={`space-y-2 text-sm font-medium ${className ?? ""}`}>
      {label}
      {children}
    </label>
  );
}
