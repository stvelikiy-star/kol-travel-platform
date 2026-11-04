"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Restores the exact approved KÖL scene with its own original WAAPI animation,
 * original brand styles, SVG icon sprites, fonts, and 3D pointer parallax.
 * Iframe isolates the original styles from Tailwind and existing workspace UI.
 * Only the visual stage lives here; the real search, catalog, Auth and workspaces
 * remain in the current Next.js application.
 */
export function OriginalWinterStage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(800);

  useEffect(() => {
    function resizeFromStage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.type !== "kol-original-stage-height") return;
      const h = Number(message.height);
      if (Number.isFinite(h) && h > 320 && h < 2400) setHeight(h);
    }
    window.addEventListener("message", resizeFromStage);
    return () => window.removeEventListener("message", resizeFromStage);
  }, []);

  return (
    <section aria-label="Анимированная зимняя главная КӨЛ" className="relative w-full overflow-hidden bg-[#EAF4F8]">
      <iframe
        ref={frame}
        title="КӨЛ — оригинальные анимированные сцены"
        src="/kol-stage/scene.html"
        loading="eager"
        onLoad={() => {
          const stored = window.localStorage.getItem("kol-locale");
          const locale = stored === "ky" || stored === "en" ? stored : "ru";
          frame.current?.contentWindow?.postMessage({ type: "kol-locale", locale }, window.location.origin);
        }}
        scrolling="no"
        className="block w-full border-0"
        style={{ height }}
      />
    </section>
  );
}
