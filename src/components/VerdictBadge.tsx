const STYLES: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  AC:      { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/30", label: "AC" },
  WA:      { bg: "bg-rose-500/10",    text: "text-rose-400",    ring: "ring-rose-500/30",    label: "WA" },
  TLE:     { bg: "bg-orange-500/10",  text: "text-orange-400",  ring: "ring-orange-500/30",  label: "TLE" },
  RTE:     { bg: "bg-rose-500/10",    text: "text-rose-400",    ring: "ring-rose-500/30",    label: "RE" },
  CE:      { bg: "bg-amber-500/10",   text: "text-amber-400",   ring: "ring-amber-500/30",   label: "CE" },
  MLE:     { bg: "bg-purple-500/10",  text: "text-purple-400",  ring: "ring-purple-500/30",  label: "MLE" },
  QUEUED:  { bg: "bg-sky-500/10",     text: "text-sky-400",     ring: "ring-sky-500/30",     label: "QUEUED" },
  RUNNING: { bg: "bg-blue-500/10",    text: "text-blue-400",    ring: "ring-blue-500/30",    label: "..." },
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  const s = STYLES[verdict] ?? { bg: "bg-slate-500/10", text: "text-slate-400", ring: "ring-slate-500/20", label: verdict };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${s.bg} ${s.text} ${s.ring}`}
    >
      {s.label}
    </span>
  );
}
