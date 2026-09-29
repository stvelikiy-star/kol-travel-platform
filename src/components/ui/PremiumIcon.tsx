import Image from "next/image";

export type PremiumIconName =
  | "home"
  | "search"
  | "calendar"
  | "calendar_manage"
  | "hotel"
  | "tours"
  | "map_pin"
  | "shield"
  | "gift"
  | "restaurant"
  | "shop"
  | "analytics"
  | "partner"
  | "operator"
  | "support"
  | "dashboard"
  | "delivery"
  | "user"
  | "chevron_right";

type PremiumIconProps = {
  name: PremiumIconName;
  size?: number;
  className?: string;
  alt?: string;
};

export function PremiumIcon({ name, size = 48, className, alt = "" }: PremiumIconProps) {
  return (
    <Image
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={className}
      height={size}
      src={`/media/kol/icons/${name}.svg`}
      width={size}
    />
  );
}
