import { PartnerCard } from "@/components/cards/PartnerCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPartners } from "@/lib/data/partners";

const benefits = [
  "заказы и брони в одном кабинете",
  "CRM партнёра",
  "stop-кнопка",
  "акции и скидки",
  "аналитика и финансы"
];

export default function PartnersPage() {
  const partners = getPartners();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <SectionTitle
            description="Подключите отель, ресторан, магазин, туры или услуги доставки к единой платформе Иссык-Куля."
            eyebrow="Партнёрам"
            title="Стать партнёром KÖL"
          />
          <Card>
            <CardContent className="space-y-4 p-5">
              <Badge variant="info">Business tools</Badge>
              <div className="grid gap-3">
                {benefits.map((benefit) => (
                  <p className="rounded-md bg-background px-3 py-2 text-sm font-medium" key={benefit}>
                    {benefit}
                  </p>
                ))}
              </div>
              <Button className="w-full">Оставить заявку партнёра</Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {partners.map((partner) => (
            <PartnerCard key={partner.id} partner={partner} />
          ))}
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}
