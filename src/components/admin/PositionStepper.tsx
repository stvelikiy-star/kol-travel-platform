"use client";

import { useState } from "react";

/** Visual input control only. Uses the existing promotion creation action and its 1–50 contract. */
export function PositionStepper({ className }: { className?: string }) {
  const [position, setPosition] = useState(1);
  const clamp = (value: number) => Math.min(50, Math.max(1, Number.isFinite(value) ? value : 1));
  return (
    <div className="kol-adm-position" role="group" aria-label="Порядок нового размещения">
      <button type="button" aria-label="Выше в списке" title="Выше в списке"
        disabled={position <= 1} onClick={() => setPosition((n) => clamp(n-1))}>↑</button>
      <input className={className} name="position" type="number" min={1} max={50}
        value={position} required aria-label="Позиция от 1 до 50"
        onChange={(event) => setPosition(clamp(Number(event.target.value)))}/>
      <button type="button" aria-label="Ниже в списке" title="Ниже в списке"
        disabled={position >= 50} onClick={() => setPosition((n) => clamp(n+1))}>↓</button>
    </div>
  );
}
