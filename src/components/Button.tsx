import Link from "next/link";
import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  icon?: string;
  iconPosition?: "left" | "right";
  type?: "button" | "submit" | "reset";
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  onClick,
  disabled = false,
  className = "",
  icon,
  iconPosition = "left",
  type = "button"
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-[var(--teal)] text-white hover:opacity-90 hover:shadow-lg hover:shadow-[var(--teal)]/30 active:scale-95",
    secondary: "bg-[var(--surface-strong)] text-[var(--cream)] border border-[var(--line)] hover:bg-[var(--surface-strong-hover)] hover:border-[var(--teal)]/50",
    ghost: "text-[var(--navy)] hover:bg-[var(--paper)] hover:text-[var(--teal)]",
    danger: "bg-rose-500 text-white hover:bg-rose-600 hover:shadow-lg hover:shadow-rose-500/30 active:scale-95",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  const content = (
    <>
      {icon && iconPosition === "left" && <span aria-hidden="true">{icon}</span>}
      {children}
      {icon && iconPosition === "right" && <span aria-hidden="true">{icon}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}
