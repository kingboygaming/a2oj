import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "default" | "teal" | "purple";
  size?: "sm" | "md" | "lg";
  icon?: string;
  pulse?: boolean;
  className?: string;
}

export function Badge({ 
  children, 
  variant = "default", 
  size = "md", 
  icon, 
  pulse = false,
  className = "" 
}: BadgeProps) {
  const variants = {
    success: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30 shadow-emerald-500/20",
    warning: "bg-amber-500/15 text-amber-400 ring-amber-500/30 shadow-amber-500/20",
    danger: "bg-rose-500/15 text-rose-400 ring-rose-500/30 shadow-rose-500/20",
    info: "bg-sky-500/15 text-sky-400 ring-sky-500/30 shadow-sky-500/20",
    teal: "bg-[var(--teal)]/15 text-[var(--teal)] ring-[var(--teal)]/30 shadow-[var(--teal)]/20",
    purple: "bg-purple-500/15 text-purple-400 ring-purple-500/30 shadow-purple-500/20",
    default: "bg-slate-500/15 text-slate-400 ring-slate-500/20"
  };

  const sizes = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5"
  };

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset
        transition-all duration-200 shadow-sm
        ${variants[variant]} ${sizes[size]} ${className}
        ${pulse ? "animate-pulse" : ""}
      `}
    >
      {icon && <span className="text-current" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

interface DifficultyBadgeProps {
  difficulty: "EASY" | "MEDIUM" | "HARD";
  showLabel?: boolean;
}

export function DifficultyBadge({ difficulty, showLabel = true }: DifficultyBadgeProps) {
  const config = {
    EASY: { 
      label: "Dễ", 
      icon: "●", 
      variant: "success" as const,
      gradient: "from-emerald-500/20 to-emerald-600/20"
    },
    MEDIUM: { 
      label: "Trung bình", 
      icon: "●●", 
      variant: "warning" as const,
      gradient: "from-amber-500/20 to-amber-600/20"
    },
    HARD: { 
      label: "Khó", 
      icon: "●●●", 
      variant: "danger" as const,
      gradient: "from-rose-500/20 to-rose-600/20"
    }
  };

  const { label, icon, variant, gradient } = config[difficulty];

  return (
    <Badge variant={variant} icon={icon} className={`bg-gradient-to-r ${gradient}`}>
      {showLabel && label}
    </Badge>
  );
}
