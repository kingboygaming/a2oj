const STYLES: Record<string, string> = {
  AC: "bg-emerald-100 text-emerald-800",
  WA: "bg-rose-100 text-rose-800",
  TLE: "bg-rose-100 text-rose-800",
  RTE: "bg-rose-100 text-rose-800",
  CE: "bg-amber-100 text-amber-900",
  MLE: "bg-rose-100 text-rose-800",
  QUEUED: "bg-sky-100 text-sky-800",
  RUNNING: "bg-sky-100 text-sky-800",
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[verdict] ?? "bg-slate-100"}`}
    >
      {verdict === "RTE" ? "RE" : verdict}
    </span>
  );
}
