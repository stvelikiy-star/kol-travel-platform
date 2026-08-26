"use client";

import { usePathname } from "next/navigation";
import { presentationMedia } from "@/lib/presentation-media";

export function KolAmbientBackground() {
  const pathname = usePathname();
  const isWorkspace = ["/admin", "/partner", "/courier", "/client", "/owner"].some((prefix) => pathname.startsWith(prefix));

  return (
    <div aria-hidden="true" className={`kol-ambient ${isWorkspace ? "kol-ambient--workspace" : ""}`}>
      <div className="kol-ambient__photo" style={{ backgroundImage: `url("${presentationMedia.ambientLake}")` }} />
      <div className="kol-ambient__wash" />
      <div className="kol-ambient__sun" />
      <div className="kol-ambient__mountains kol-ambient__mountains--far" />
      <div className="kol-ambient__mountains kol-ambient__mountains--near" />
      <div className="kol-ambient__water">
        <span className="kol-wave kol-wave--one" />
        <span className="kol-wave kol-wave--two" />
        <span className="kol-wave kol-wave--three" />
      </div>
      <div className="kol-ambient__grain" />
    </div>
  );
}
