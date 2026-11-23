import Link from "next/link";
import { Container } from "@/components/ui/Container";

type PageHeroProps = {
  crumb: string;
  number: string;
  titleTop: string;
  titleAccent: string;
  lead: string;
  image: string;
  glassLabel: string;
  glassText: string;
  ctaHref?: string;
  ctaLabel?: string;
};

/** Герой внутренних страниц: только оформление, содержимое передаётся страницей. */
export function PageHero({ crumb, number, titleTop, titleAccent, lead, image, glassLabel, glassText, ctaHref, ctaLabel }: PageHeroProps) {
  return (
    <section className="kol-pg">
      <div aria-hidden="true" className="kol-pg-orb" />
      <div aria-hidden="true" className="kol-arc kol-arc--a" />
      <div aria-hidden="true" className="kol-arc kol-arc--b" />
      <Container>
        <div className="kol-pg-grid">
          <div>
            <p className="kol-crumbs"><Link href="/">Главная</Link><span>/</span><span>{crumb}</span></p>
            <p className="kol-kick"><span>{number}</span><i /><span>КӨЛ · Всё рядом</span></p>
            <h1 className="kol-ttl" data-kol-pagehero-original={`${titleTop} ${titleAccent}`}
              data-i18n-ignore="true" data-kol-pagehero-ru-top={titleTop}
              data-kol-pagehero-ru-accent={titleAccent} aria-label={`${titleTop} ${titleAccent}`}>
              <span className="kol-ln"><span data-kol-pagehero-top style={{ ["--dl" as string]: "0ms" }}>{titleTop}</span></span>{" "}
              <span className="kol-ln kol-ln--last"><span data-kol-pagehero-accent style={{ ["--dl" as string]: "100ms" }}>{titleAccent}</span></span>
            </h1>
            <p className="kol-lead">{lead}</p>
            {ctaHref && ctaLabel ? (
              <div className="mt-7"><a className="kol-hbtn kol-hbtn--turq kol-shim" href={ctaHref}>{ctaLabel}</a></div>
            ) : null}
          </div>
          <div className="kol-art">
            <div aria-hidden="true" className="kol-art-ring" />
            <div className="kol-art-shape"><div style={{ backgroundImage: `url("${image}")` }} /></div>
            <div className="kol-glass"><small>{glassLabel}</small><b>{glassText}</b></div>
          </div>
        </div>
      </Container>
    </section>
  );
}
