import { CartPageClient } from "@/components/cart/CartPageClient";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/layout/PageHero";

export default function CartPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <PageHero crumb="Корзина" number="04" titleTop="Ваша" titleAccent="корзина" lead="Соберите еду и товары для отдыха в одной заявке." image="/kol-winter/scene-delivery.webp" glassLabel="Доставка KÖL" glassText="Еда · товары · заявка" />
      <Container className="space-y-8 py-10">
        <CartPageClient />
      </Container>
      <PublicFooter />
    </main>
  );
}
