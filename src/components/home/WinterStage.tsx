"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import "./WinterStage.css";

type StageItem = {
  id: "stay" | "tours" | "delivery" | "transfer";
  title: string;
  lines: string[];
  description: string;
  href: string;
  action: string;
  image: string;
  mobileImage?: string;
  shape: string;
};

type WinterStageProps = { images: { stay: string; tours: string; delivery: string; transfer: string; stayMobile?: string; toursMobile?: string; deliveryMobile?: string; transferMobile?: string } };

export function WinterStage({ images }: WinterStageProps) {
  const scenes: StageItem[] = [
    { id: "stay", title: "Проживание", lines: ["Просыпайтесь", "у Иссык-Куля"], description: "Зимние отели, гостевые дома и уютные коттеджи. Найдите место для своего отдыха.", href: "/stays", action: "Выбрать проживание", image: images.stay, mobileImage: images.stayMobile, shape: "arch" },
    { id: "tours", title: "Туры", lines: ["Откройте", "больше, чем", "берег"], description: "Снежные горы, зимние маршруты и новые впечатления у Иссык-Куля.", href: "/tours", action: "Посмотреть туры", image: images.tours, mobileImage: images.toursMobile, shape: "pebble" },
    { id: "delivery", title: "Доставка", lines: ["Вкусный отдых.", "Всё рядом."], description: "Еда и необходимые товары там, где вы отдыхаете. Заказывайте без лишних хлопот.", href: "/delivery", action: "Открыть доставку", image: images.delivery, mobileImage: images.deliveryMobile, shape: "round" },
    { id: "transfer", title: "Трансфер", lines: ["Ваш отдых", "начинается", "с дороги"], description: "Дорога в Каракол, до отеля и горнолыжной базы — выберите удобный маршрут.", href: "/transfer", action: "Выбрать трансфер", image: images.transfer, mobileImage: images.transferMobile, shape: "ticket" }
  ];
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const mediaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scene = scenes[active];

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);

  const reset = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const el = mediaRef.current;
    if (!el) return;
    el.style.setProperty("--kol-tilt-x", "0deg");
    el.style.setProperty("--kol-tilt-y", "0deg");
    el.style.setProperty("--kol-shift-x", "0px");
    el.style.setProperty("--kol-shift-y", "0px");
  }, []);

  useEffect(() => reset, [reset]);

  const onMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType === "touch" || window.innerWidth < 901) return;
    const el = mediaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      el.style.setProperty("--kol-tilt-x", (-y * 4).toFixed(2) + "deg");
      el.style.setProperty("--kol-tilt-y", (x * 5).toFixed(2) + "deg");
      el.style.setProperty("--kol-shift-x", (x * -12).toFixed(1) + "px");
      el.style.setProperty("--kol-shift-y", (y * -11).toFixed(1) + "px");
    });
  }, [reduced]);

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "ArrowRight" ? (index + 1) % scenes.length
      : event.key === "ArrowLeft" ? (index + scenes.length - 1) % scenes.length
      : event.key === "Home" ? 0
      : event.key === "End" ? scenes.length - 1
      : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

  const select = (index: number) => {
    reset();
    setActive((index + scenes.length) % scenes.length);
  };

  return (
    <section aria-label="Зимний КӨЛ — направления" className="kw-stage" id="winter-stage">
      <div className="kw-stage__grain" aria-hidden="true" />
      <div className="kw-stage__wrap">
        <div aria-labelledby={"kw-tab-" + scene.id} className="kw-stage__copy" id="kw-panel" key={scene.id} role="tabpanel" tabIndex={0}>
          <div className="kw-stage__eyebrow">КӨЛ · ЗИМНИЙ ИССЫК-КУЛЬ</div>
          <div className="kw-stage__index">0{active + 1} <span>/ 04</span></div>
          <h1>{scene.lines.map((line, i) => <span key={i}>{line}</span>)}</h1>
          <p>{scene.description}</p>
          <Link className="kw-stage__cta" href={scene.href}>{scene.action} <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="kw-stage__visual" onPointerMove={onMove} onPointerLeave={reset} ref={mediaRef}>
          <div className="kw-stage__glow" aria-hidden="true" />
          <div className={"kw-stage__art kw-stage__art--" + scene.shape} key={scene.id}>
            {/* All visual media is decorative, while the neighboring heading and link remain fully accessible. */}
            <picture className="kw-stage__photo" aria-hidden="true">
              <source media="(max-width: 760px)" srcSet={scene.mobileImage ?? scene.image} />
              <Image src={scene.image} alt="" fill loading="eager" unoptimized sizes="(max-width: 760px) 90vw, 470px" />
            </picture>
          </div>
          <div className="kw-stage__ring" aria-hidden="true" />
        </div>
      </div>
      <div className="kw-stage__controls">
        <div className="kw-stage__tabs" role="tablist" aria-label="Выберите направление">
          {scenes.map((item, i) => (
            <button aria-controls="kw-panel" aria-label={"Показать: " + item.title} aria-selected={active === i} className={"kw-stage__tab" + (active === i ? " is-active" : "")} id={"kw-tab-" + item.id} key={item.id} onClick={() => select(i)} onKeyDown={(event) => onTabKeyDown(event, i)} ref={(el) => { tabRefs.current[i] = el; }} role="tab" tabIndex={active === i ? 0 : -1} type="button">
              <span className="kw-stage__thumbnail" style={{ backgroundImage: 'url("' + item.image + '")' }} />
              <span>{item.title}</span>
            </button>
          ))}
        </div>
        <div className="kw-stage__arrows">
          <button aria-label="Предыдущая сцена" onClick={() => select(active - 1)} type="button">←</button>
          <button aria-label="Следующая сцена" onClick={() => select(active + 1)} type="button">→</button>
        </div>
      </div>
    </section>
  );
}
