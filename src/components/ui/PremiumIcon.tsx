import type { SVGProps } from "react";

const paths: Record<string, string> = {
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h3m-3 4h5"
};

export function PremiumIcon({ name, size = 20, ...props }: { name: keyof typeof paths; size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}><path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
