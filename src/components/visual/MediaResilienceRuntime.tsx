"use client";

import { useEffect } from "react";

const FALLBACKS = [
  {
    match: "Kyrgyz%20Yurt%2C%20Kyrgyzstan.jpg",
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Kyrgyz_Yurt%2C_Kyrgyzstan.jpg/960px-Kyrgyz_Yurt%2C_Kyrgyzstan.jpg"
  },
  {
    match: "Kyrgyzstan%20%286052093045%29.jpg",
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg/960px-Skazka_Canyon%2C_Kyrgyzstan_%2843713843865%29.jpg"
  },
  {
    match: "Felt%20toys%20in%20Kyrgyzstan.jpg",
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Felt_toys_in_Kyrgyzstan.jpg/960px-Felt_toys_in_Kyrgyzstan.jpg"
  }
] as const;

function applyFallback(image: HTMLImageElement) {
  if (image.dataset.kolMediaFallbackApplied === "true") return;

  const fallback = FALLBACKS.find((item) => image.src.includes(item.match));
  if (!fallback) return;

  image.dataset.kolMediaFallbackApplied = "true";
  image.src = fallback.src;
}

export function MediaResilienceRuntime() {
  useEffect(() => {
    const handleError = (event: Event) => {
      if (event.target instanceof HTMLImageElement) {
        applyFallback(event.target);
      }
    };

    document.addEventListener("error", handleError, true);

    const repairAlreadyFailed = () => {
      document.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        if (image.complete && image.naturalWidth === 0) applyFallback(image);
      });
    };

    repairAlreadyFailed();
    const observer = new MutationObserver(repairAlreadyFailed);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.removeEventListener("error", handleError, true);
    };
  }, []);

  return null;
}
