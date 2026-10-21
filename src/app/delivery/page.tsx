import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Container } from "@/components/ui/Container";
import { presentationMedia } from "@/lib/presentation-media";

const sections = [
  {
    title: "Еда",
    description: "Блюда и предложения ресторанов. Выберите понравившееся и отправьте заявку.",
    href: "/food",
    image: presentationMedia.manty,
  },
  {
    title: "Магазин",
    description: "Товары и всё необходимое для отдыха. Оформление через одну заявку на доставку.",
    href: "/shop",
    image: presentationMedia.bazaar,
  },
] as const;

export const metadata = {
  title: "Доставка — еда и товары | KÖL",
  description: "Еда и покупки в одном месте. Выбирайте предложения и отправляйте заявку на доставку через KÖL.",
};

export default function DeliveryPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <section className="border-b border-border/70 bg-slate-950 py-14 text-white sm:py-20">
        <Container>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">KÖL · Иссык-Куль</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Доставка</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-200">Еда и магазин — в одном разделе. Выбирайте блюда или товары, а оператор подтвердит наличие, цену и доставку.</p>
        </Container>
      </section>
      <Container className="grid gap-5 py-10 md:grid-cols-2 md:py-14">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="group overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-600">
            <div className="h-48 bg-cover bg-center sm:h-64" style={{ backgroundImage: `url("${section.image}")` }} role="img" aria-label={section.title} />
            <div className="space-y-3 p-6">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <p className="text-slate-600">{section.description}</p>
              <span className="inline-flex font-semibold text-cyan-800 group-hover:underline">Смотреть предложения →</span>
            </div>
          </Link>
        ))}
      </Container>
      <PublicFooter />
    </main>
  );
}
