"use client";

import { useState } from "react";
import { submitPublicIntakeRequest } from "@/app/actions/public/intake";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export default function PartnersPage() {
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [email,setEmail]=useState("");
  const [business,setBusiness]=useState(""); const [type,setType]=useState("hotel"); const [location,setLocation]=useState(""); const [comment,setComment]=useState("");
  const [requestId,setRequestId]=useState<string|null>(null); const [error,setError]=useState<string|null>(null); const [loading,setLoading]=useState(false);
  async function submit(){ setError(null); setRequestId(null); if(name.trim().length<2||phone.trim().length<5||business.trim().length<2){setError("Укажите имя, телефон и название бизнеса.");return;} setLoading(true); try { const result=await submitPublicIntakeRequest({kind:"support",title:`Партнёр KÖL · ${business.trim()}`,contact:{name,phone,email},payload:{request_type:"partner_application",business:{name:business.trim(),type,location},comment,source_path:"/partners"}}); if(!result.ok){setError(result.message);return;} setRequestId(result.requestId);} catch {setError("Не удалось отправить заявку. Попробуйте ещё раз.");} finally {setLoading(false);} }
  return <main className="min-h-screen bg-background text-foreground"><PublicHeader/><Container className="space-y-8 py-10"><SectionTitle eyebrow="Партнёрам" title="Стать партнёром KÖL" description="Без регистрации и кабинетов на первом шаге. Отправьте заявку — мы свяжемся и подключим ваш бизнес."/>{requestId?<Card className="border-success"><CardContent className="p-5 text-sm text-success"><p className="font-semibold">Заявка принята.</p><p className="mt-2">Номер: <span className="font-mono font-semibold">{requestId}</span></p></CardContent></Card>:null}{error?<Card className="border-danger"><CardContent className="p-5 text-sm font-semibold text-danger">{error}</CardContent></Card>:null}<Card><CardHeader><CardTitle>Заявка партнёра</CardTitle><CardDescription>Отель, ресторан, магазин, туры, транспорт или другой сервис.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Input placeholder="Ваше имя *" value={name} onChange={e=>setName(e.target.value)}/><Input placeholder="Телефон *" value={phone} onChange={e=>setPhone(e.target.value)}/><Input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><Input placeholder="Название бизнеса *" value={business} onChange={e=>setBusiness(e.target.value)}/><Select value={type} onChange={e=>setType(e.target.value)}><option value="hotel">Отель / жильё</option><option value="restaurant">Ресторан / кафе</option><option value="shop">Магазин</option><option value="tour">Туры / гид</option><option value="transport">Транспорт</option><option value="other">Другое</option></Select><Input placeholder="Локация" value={location} onChange={e=>setLocation(e.target.value)}/><Textarea className="md:col-span-2" placeholder="Расскажите коротко о бизнесе" value={comment} onChange={e=>setComment(e.target.value)}/><Button className="md:col-span-2" disabled={loading} onClick={submit}>{loading?"Отправляем…":"Отправить заявку"}</Button></CardContent></Card></Container><PublicFooter/></main>;
}
