"use client";

import { useState } from "react";
import { submitPublicIntakeRequest } from "@/app/actions/public/intake";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Textarea } from "@/components/ui/Textarea";

export default function TransferPage() {
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [from,setFrom]=useState(""); const [to,setTo]=useState(""); const [date,setDate]=useState(""); const [guests,setGuests]=useState(1); const [comment,setComment]=useState(""); const [requestId,setRequestId]=useState<string|null>(null); const [error,setError]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  async function submit(){setError(null);setRequestId(null);if(name.trim().length<2||phone.trim().length<5||from.trim().length<2||to.trim().length<2||!date){setError("Заполните имя, телефон, маршрут и дату.");return;}setBusy(true);try{const r=await submitPublicIntakeRequest({kind:"booking_request",title:`Заявка на трансфер · ${from.trim()} → ${to.trim()}`,contact:{name,phone},payload:{request_type:"transfer",route:{from:from.trim(),to:to.trim()},date,guests,comment,quoted:false,source_path:"/transfer"}});if(r.ok)setRequestId(r.requestId);else setError(r.message);}catch{setError("Не удалось сохранить заявку. Попробуйте ещё раз.");}finally{setBusy(false);}}
  return <main className="min-h-screen bg-background text-foreground"><PublicHeader/><Container className="space-y-8 py-10"><SectionTitle eyebrow="Трансфер KÖL" title="Заказать трансфер" description="Укажите маршрут и дату. Оператор проверит машину, стоимость и подтвердит поездку."/>
  {requestId?<Card className="border-success"><CardContent className="p-5 text-sm text-success"><p className="font-semibold">Заявка принята.</p><p>Номер: <span className="font-mono">{requestId}</span></p></CardContent></Card>:null}{error?<Card className="border-danger"><CardContent className="p-5 text-sm font-semibold text-danger">{error}</CardContent></Card>:null}
  <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Маршрут</CardTitle></CardHeader><CardContent className="grid gap-4"><Input placeholder="Откуда *" value={from} onChange={e=>setFrom(e.target.value)}/><Input placeholder="Куда *" value={to} onChange={e=>setTo(e.target.value)}/><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/><Input min={1} type="number" value={guests} onChange={e=>setGuests(Math.max(1,Number(e.target.value)||1))}/></CardContent></Card>
  <Card><CardHeader><CardTitle>Контакты</CardTitle></CardHeader><CardContent className="grid gap-4"><Input placeholder="Ваше имя *" value={name} onChange={e=>setName(e.target.value)}/><Input placeholder="Телефон *" value={phone} onChange={e=>setPhone(e.target.value)}/><Textarea placeholder="Багаж, детское кресло, время прибытия или другой комментарий" value={comment} onChange={e=>setComment(e.target.value)}/><Button disabled={busy} onClick={submit}>{busy?"Отправляем…":"Отправить заявку"}</Button></CardContent></Card></div>
  </Container><PublicFooter/></main>;
}
