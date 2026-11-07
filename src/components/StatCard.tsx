import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number | string;
  href: string;
  icon: string;
  accent: string;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
}

export function StatCard({ label, value, href, icon, accent, trend }: StatCardProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border border-[var(--line)] bg-gradient-to-br from-[var(--paper)] to-[var(--background)] p-5 transition-all duration-300 hover:border-[var(--teal)]/50 hover:shadow-xl hover:shadow-[var(--teal)]/10 hover:-translate-y-1"
    >
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--teal)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] mb-2">
            {label}
          </p>
          <p className="text-3xl font-bold tabular-nums text-[var(--navy)] group-hover:text-[var(--teal)] transition-colors">
            {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
          </p>
          {trend && (
            <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trend.direction === "up" ? "text-emerald-400" : "text-rose-400"}`}>
              <span aria-hidden="true">{trend.direction === "up" ? "↑" : "↓"}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        
        <div className={`flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--background)] to-[var(--surface-strong)] font-mono text-xl font-bold shadow-lg ${accent} transition-transform group-hover:scale-110 group-hover:rotate-6`}>
          {icon}
        </div>
      </div>
    </Link>
  );
}
