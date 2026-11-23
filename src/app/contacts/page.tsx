"use client";

import { useState } from "react";
import { usePublicIntakeRetry } from "@/lib/intake/use-public-intake-retry";
import { PageHero } from "@/components/layout/PageHero";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const contacts = ["WhatsApp", "Telegram", "Email", "Бишкек / Иссык-Куль"];
const requestLabels = {
  partner: "Подключение партнёра",
  client: "Вопрос клиента",
  support: "Поддержка"
} as const;
type ContactRequestType = keyof typeof requestLabels;

export default function ContactsPage() {
  const submitPublicIntakeRequest = usePublicIntakeRetry();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<ContactRequestType>("partner");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(undefined);
    setRequestId(undefined);
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 7 || message.trim().length < 3) {
      setError("Укажите имя, телефон и сообщение.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitPublicIntakeRequest({
        kind: "support",
        title: "Контакты KÖL · " + requestLabels[kind],
        contact: { name, phone },
        honeypot,
        payload: { request_type: kind, message: message.trim(), source_path: "/contacts" }
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRequestId(result.requestId);
    } catch {
      setError("Не удалось отправить обращение. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <PageHero crumb="Контакты" glassLabel="Связь" glassText="Бишкек · Иссык-Куль" image="/kol-winter/scene-transfer.webp" lead="Оставьте обращение: оно сохранится в системе заявок KÖL. Контактные каналы публикуются только после подтверждения владельцем." number="05" titleAccent="с нами" titleTop="Связаться" />
      <Container className="space-y-8 py-10">
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => <Card className="kol-card" key={contact}><CardContent className="space-y-2 p-5 pt-5"><Badge variant="muted">{contact}</Badge><p className="text-sm text-muted">Контакт ещё не подтверждён</p></CardContent></Card>)}
            </div>
          </div>
          <Card>
            <CardContent className="space-y-4 p-5">
              <Input autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="Имя" required value={name} />
              <Input autoComplete="tel" onChange={(event) => setPhone(event.target.value)} placeholder="Телефон" required value={phone} />
              <Select onChange={(event) => setKind(event.target.value as ContactRequestType)} value={kind}>
                <option value="partner">Подключение партнёра</option>
                <option value="client">Вопрос клиента</option>
                <option value="support">Поддержка</option>
              </Select>
              <Textarea onChange={(event) => setMessage(event.target.value)} placeholder="Сообщение" required value={message} />
              <input aria-hidden="true" autoComplete="off" className="absolute -left-[9999px]" name="company_website" onChange={(event) => setHoneypot(event.target.value)} tabIndex={-1} type="text" value={honeypot} />
              {error ? <p className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm font-semibold text-danger" role="alert">{error}</p> : null}
              {requestId ? <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm" role="status"><p className="font-semibold text-success">Обращение сохранено.</p><p className="mt-1 text-muted">Номер заявки: <span className="font-mono">{requestId}</span>. Оператор KÖL рассмотрит обращение.</p></div> : null}
              <Button className="w-full" disabled={loading} onClick={submit} type="button">{loading ? "Отправляем…" : "Отправить обращение"}</Button>
            </CardContent>
          </Card>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}
