import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const contacts = ["WhatsApp", "Telegram", "Email", "Бишкек / Иссык-Куль"];

export default function ContactsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <SectionTitle
              description="Свяжитесь с командой KÖL для подключения партнёра или вопросов по платформе."
              eyebrow="Контакты"
              title="Контакты"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => (
                <Card key={contact}>
                  <CardContent className="space-y-2 p-5">
                    <Badge variant="muted">{contact}</Badge>
                    <p className="text-sm text-muted">скоро</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="space-y-4 p-5">
              <Input placeholder="Имя" />
              <Input placeholder="Телефон" />
              <Select defaultValue="partner">
                <option value="partner">Тип обращения</option>
                <option value="client">Вопрос клиента</option>
                <option value="support">Поддержка</option>
              </Select>
              <Textarea placeholder="Сообщение" />
              <Button className="w-full">Отправить</Button>
            </CardContent>
          </Card>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}
