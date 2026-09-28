import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "border-primary bg-primary text-white shadow-soft hover:bg-[#063B57]",
  secondary: "border-secondary bg-secondary text-white shadow-soft hover:bg-[#071C2C]",
  outline: "border-border bg-surface text-foreground hover:border-primary hover:bg-lake-light hover:text-primary",
  ghost: "border-transparent bg-transparent text-foreground shadow-none hover:bg-lake-light hover:text-primary",
  danger: "border-danger bg-danger text-white shadow-[0_8px_20px_rgba(189,63,69,0.2)] hover:bg-[#a9343a]"
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  onMouseDown,
  onPointerDown,
  title,
  ...props
}: ButtonProps) {
  const hasDirectAction = Boolean(onClick || onMouseDown || onPointerDown || type === "submit" || type === "reset");
  const isDisabled = Boolean(disabled || !hasDirectAction);
  const effectiveTitle = title ?? (!hasDirectAction ? "Действие недоступно в текущем режиме" : undefined);

  return (
    <button
      aria-disabled={isDisabled || undefined}
      className={cn(
        "inline-flex min-h-12 max-w-full items-center justify-center rounded-2xl border px-5 py-3 text-center text-sm font-semibold leading-5 transition duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        className
      )}
      disabled={isDisabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onPointerDown={onPointerDown}
      title={effectiveTitle}
      type={type}
      {...props}
    />
  );
}
