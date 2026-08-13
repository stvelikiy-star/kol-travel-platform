import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "border-primary bg-primary text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] hover:bg-teal hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]",
  secondary: "border-secondary bg-secondary text-white shadow-[0_8px_20px_rgba(49,84,107,0.18)] hover:bg-lake-dark",
  outline: "border-border bg-surface text-foreground hover:border-primary hover:bg-lake-light hover:text-primary",
  ghost: "border-transparent bg-transparent text-foreground shadow-none hover:bg-lake-light hover:text-primary",
  danger: "border-danger bg-danger text-white shadow-[0_8px_20px_rgba(189,63,69,0.2)] hover:bg-[#a9343a]"
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 max-w-full items-center justify-center rounded-md border px-4 py-2 text-center text-sm font-semibold leading-5 transition duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        className
      )}
      type={type}
      {...props}
    />
  );
}
