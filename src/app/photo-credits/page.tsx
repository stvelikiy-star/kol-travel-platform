import Link from "next/link";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

const commonsCredits = [
  {
    title: "Lake Issyk-Kul, Kyrgyzstan",
    author: "Bernard Gagnon (Bgag)",
    license: "CC0 1.0",
    source: "https://commons.wikimedia.org/wiki/File:Lake_Issyk-Kul,_Kyrgyzstan.jpg",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/"
  },
  {
    title: "Issyk Kul Lake, Issyk Kul region, Kyrgyzstan",
    author: "Vilya Shoni",
    license: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Issyk_Kul_Lake,_Issyk_Kul_region,_Kyrgyzstan.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/"
  },
  {
    title: "Skazka Canyon, Kyrgyzstan (43713843865)",
    author: "Ninara",
    license: "CC BY 2.0",
    source: "https://commons.wikimedia.org/wiki/File:Skazka_Canyon,_Kyrgyzstan_(43713843865).jpg",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/"
  },
  {
    title: "Yurta camp in the southern shore of Issyk-Kul",
    author: "Ada Awa",
    license: "CC BY-SA 2.0",
    source: "https://commons.wikimedia.org/wiki/File:Yurta_camp_in_the_southern_shore_of_Issyk-Kul.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/"
  },
  {
    title: "Kyrgyz Yurt, Kyrgyzstan",
    author: "Vilya Shoni",
    license: "CC BY 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Kyrgyz_Yurt,_Kyrgyzstan.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    title: "Бешбармак",
    author: "Arthoum",
    license: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:%D0%91%D0%B5%D1%88%D0%B1%D0%B0%D1%80%D0%BC%D0%B0%D0%BA.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/"
  },
  {
    title: "E7870-Dordoy-laghman",
    author: "Vmenkov",
    license: "CC BY-SA 3.0 (one of the offered licenses)",
    source: "https://commons.wikimedia.org/wiki/File:E7870-Dordoy-laghman.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/"
  },
  {
    title: "FOOD Mantu",
    author: "Grueslayer",
    license: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:FOOD_Mantu.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/"
  },
  {
    title: "Osh Bazaar in Bishkek, Kyrgyzstan — dried fruits and nuts",
    author: "neiljs",
    license: "CC BY 2.0",
    source: "https://commons.wikimedia.org/wiki/File:Osh_Bazaar_in_Bishkek,_Kyrgyzstan-_dried_fruits_and_nuts.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/"
  },
  {
    title: "Felt toys in Kyrgyzstan",
    author: "Vilya Shoni",
    license: "CC BY 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Felt_toys_in_Kyrgyzstan.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/"
  }
];

export default function PhotoCreditsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10 sm:py-12">
        <section className="rounded-2xl border border-border/80 bg-gradient-to-br from-lake-light via-surface to-sand-light p-6 shadow-soft sm:p-8">
          <SectionTitle
            description="Источники и лицензии фотографий, используемых в интерфейсе KÖL."
            eyebrow="KÖL · Media"
            title="Фотографии и лицензии"
          />
          <p className="mt-5 max-w-3xl text-sm leading-6 text-muted">
            Wikimedia Commons изображения могут отображаться в адаптивном интерфейсе с техническим масштабированием или кадрированием. Ссылки ниже ведут на оригинальные страницы файлов и соответствующие лицензии.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {commonsCredits.map((credit) => (
            <Card key={credit.source} className="h-full">
              <CardHeader>
                <CardTitle className="text-lg leading-6">{credit.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6">
                <p><span className="font-semibold">Автор:</span> {credit.author}</p>
                <p><span className="font-semibold">Лицензия:</span> {credit.license}</p>
                <div className="flex flex-wrap gap-3">
                  <a className="font-semibold text-primary hover:underline" href={credit.source} rel="noreferrer" target="_blank">Источник →</a>
                  <a className="font-semibold text-primary hover:underline" href={credit.licenseUrl} rel="noreferrer" target="_blank">Условия лицензии →</a>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 text-sm leading-6 shadow-card sm:p-6">
          <h2 className="font-semibold">Unsplash</h2>
          <p className="mt-2 text-muted">
            Дополнительные редакционные фотографии загружаются с Unsplash и используются по лицензии Unsplash. Атрибуция для стандартной лицензии не обязательна, но платформа-источник указана здесь для прозрачности.
          </p>
          <a className="mt-3 inline-flex font-semibold text-primary hover:underline" href="https://unsplash.com/license" rel="noreferrer" target="_blank">
            Лицензия Unsplash →
          </a>
        </section>

        <Link className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline" href="/">← Вернуться на главную</Link>
      </Container>
      <PublicFooter />
    </main>
  );
}
