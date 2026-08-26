"use client";

import { useState } from "react";
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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState("partner");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const [prepared, setPrepared] = useState(false);

  function prepareRequest() {
    setPrepared(false);
    if (!name.trim() || !phone.trim() || !message.trim()) {
      setError("Заполните имя, телефон и сообщение.");
      return;
    }
    setError(undefined);
    setPrepared(true);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <SectionTitle description="Контактные каналы публикуются только после подтверждения владельцем. Пока можно подготовить обращение без фиктивной отправки." eyebrow="Контакты" title="Контакты" />
            <div className="grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => <Card key={contact}><CardContent className="space-y-2 p-5"><Badge variant="muted">{contact}</Badge><p className="text-sm text-muted">Контакт ещё не подтверждён</p></CardContent></Card>)}
            </div>
          </div>

          <Card>
            <CardContent className="space-y-4 p-5">
              <Input autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="Имя" required value={name} />
              <Input autoComplete="tel" onChange={(event) => setPhone(event.target.value)} placeholder="Телефон" required value={phone} />
              <Select onChange={(event) => setKind(event.target.value)} value={kind}>
                <option value="partner">Подключение партнёра</option>
                <option value="client">Вопрос клиента</option>
                <option value="support">Поддержка</option>
              </Select>
              <Textarea onChange={(event) => setMessage(event.target.value)} placeholder="Сообщение" required value={message} />
              {error ? <p className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm font-semibold text-danger" role="alert">{error}</p> : null}
              {prepared ? <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm" role="status"><p className="font-semibold text-success">Обращение заполнено.</p><p className="mt-1 text-muted">Тип: {kind}. Отправка не имитируется: она станет доступна после подключения подтверждённого канала связи.</p></div> : null}
              <Button className="w-full" onClick={prepareRequest}>Проверить обращение</Button>
            </CardContent>
          </Card>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}
