import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "nav-primary" | "nav-secondary";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  href?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  onClick?: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "onClick">;

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "rounded-xl border border-ink/20 bg-ink text-cloud hover:bg-[#0b1f4b] hover:text-stone-100 transition-all",
  secondary:
    "rounded-xl bg-[#0b1f4b] text-stone-100 hover:bg-[#172850] transition-colors",
  tertiary:
    "rounded-xl border border-ink/25 bg-ember text-ink hover:bg-[#344873] hover:text-stone-100 transition-all",
  "nav-primary":
    "rounded-full border border-ink/20 bg-cloud text-ink hover:bg-[#172850] hover:text-stone-100 transition-all",
  "nav-secondary":
    "rounded-full border border-ink/20 bg-cloud text-ink hover:bg-[#344873] hover:text-stone-100 active:scale-[0.98] active:bg-forest active:text-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 transition-all",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-6 py-2.5 text-base font-medium",
  md: "px-7 py-3.5 font-semibold text-center",
  lg: "px-10 py-5 font-semibold text-xl",
};

export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  onClick,
  type = "button",
  ...buttonProps
}: ButtonProps) {
  const baseClass = `${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {children}
      </Link>
    );
  }

  return (
    <button className={baseClass} onClick={onClick} type={type} {...buttonProps}>
      {children}
    </button>
  );
}
