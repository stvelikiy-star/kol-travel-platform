import type { SVGProps } from "react";

export type KolIconName = "stay" | "tour" | "delivery" | "transfer" | "search" | "arrow" | "close" | "concierge" | "menu" | "heart";
export function KolIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: KolIconName }) {
 const paths: Record<KolIconName, React.ReactNode> = {
  stay: <><path d="M3 20V9l9-6 9 6v11"/><path d="M8 20v-7h8v7M3 20h18"/></>,
  tour: <><path d="m2 20 7-12 4 6 3-4 6 10H2Z"/><path d="m8 10 2 2 2-2M18 3v5m-2.5-2.5h5"/></>,
  delivery: <><path d="M4 8h11v10H4zM15 11h4l3 4v3h-7"/><circle cx="8" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M7 5h6"/></>,
  transfer: <><path d="m5 9 2-4h10l2 4 2 3v7h-3v-2H6v2H3v-7l2-3Z"/><path d="M4 12h16M7 15h2m6 0h2"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></>,
  arrow: <><path d="M4 12h16m-7-7 7 7-7 7"/></>,
  close: <><path d="M5 5 19 19M19 5 5 19"/></>,
  concierge: <><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  heart: <><path d="M20.5 8.5c0 4.2-8.5 10-8.5 10s-8.5-5.8-8.5-10a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2Z"/></>
 };
 return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
