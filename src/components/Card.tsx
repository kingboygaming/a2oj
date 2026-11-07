import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  variant?: "default" | "glass" | "gradient";
}

export function Card({ children, className = "", hover = false, glow = false, variant = "default" }: CardProps) {
  const baseStyles = "rounded-xl border transition-all duration-300";
  
  const variantStyles = {
    default: "border-[var(--line)] bg-[var(--paper)]",
    glass: "border-white/10 bg-gradient-to-br from-[var(--paper)]/80 to-[var(--paper)]/40 backdrop-blur-sm",
    gradient: "border-[var(--line)] bg-gradient-to-br from-[var(--paper)] to-[var(--background)]"
  };

  const hoverStyles = hover ? "hover:border-[var(--teal)]/50 hover:shadow-xl hover:shadow-[var(--teal)]/10 hover:-translate-y-0.5" : "";
  const glowStyles = glow ? "shadow-lg shadow-[var(--teal)]/20" : "shadow-sm";

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${glowStyles} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  icon?: string;
  badge?: ReactNode;
}

export function CardHeader({ children, className = "", icon, badge }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-[var(--line)]/50 px-5 py-4 ${className}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && (
          <span className="flex-shrink-0 text-xl" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {badge && <div className="flex-shrink-0">{badge}</div>}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={`flex items-center justify-between border-t border-[var(--line)]/50 px-5 py-3 text-sm ${className}`}>
      {children}
    </div>
  );
}
