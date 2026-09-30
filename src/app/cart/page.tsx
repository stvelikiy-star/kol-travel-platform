import { CartPageClient } from "@/components/cart/CartPageClient";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function CartPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <SectionTitle description="Соберите еду и товары для отдыха в одной заявке." eyebrow="Доставка KÖL" title="Ваша корзина" />
        <CartPageClient />
      </Container>
      <PublicFooter />
    </main>
  );
}
