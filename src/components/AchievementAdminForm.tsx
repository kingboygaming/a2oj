"use client";

import { useState } from "react";
import { ACHIEVEMENT_COLOR_CLASSES, ACHIEVEMENT_RARITIES, ACHIEVEMENT_TRIGGERS } from "@/lib/rank-colors";

const rarityNames: Record<string, string> = { COMMON: "Common", UNCOMMON: "Uncommon", RARE: "Rare", EPIC: "Epic", LEGENDARY: "Legendary", SECRET: "Secret" };
const triggerNames: Record<string, string> = { SOLVED_PROBLEMS: "Giải đủ số bài", CONTESTS: "Tham gia đủ contest", CONTEST_PODIUMS: "Đạt top 3 contest", CONTEST_WINS: "Vô địch contest", RANK_POINTS: "Đạt điểm rank", PROBLEM_AC: "AC một bài cụ thể", HEURISTIC_SCORE: "Đạt điểm heuristic", WRONG_ANSWERS: "Có đủ lượt nộp WA", CE_STREAK: "Nộp CE liên tiếp" };

export function AchievementAdminForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [trigger, setTrigger] = useState("SOLVED_PROBLEMS");
  const [rarity, setRarity] = useState("COMMON");
  const [colorEnabled, setColorEnabled] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      slug: String(form.get("slug")), title: String(form.get("title")), description: String(form.get("description")), icon: String(form.get("icon")),
      rarity: String(form.get("rarity")), secret: form.get("rarity") === "SECRET", triggerType: trigger, threshold: Number(form.get("threshold")),
      problemSlug: String(form.get("problemSlug") || "") || null, nameColorEnabled: colorEnabled,
      nameColor: colorEnabled ? String(form.get("nameColor")) : null,
    };
    try {
      const response = await fetch("/api/admin/achievements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { setError(true); setMessage(result.error || "Không thể tạo thành tựu."); return; }
      setError(false); setMessage("Đã tạo thành tựu."); window.location.reload();
    } catch { setError(true); setMessage("Không thể kết nối máy chủ."); }
    finally { setPending(false); }
  }

  return <form onSubmit={submit} className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
    <h2 className="text-lg font-semibold text-[var(--navy)]">Tạo thành tựu</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tên thành tựu"><input name="title" required maxLength={100} className={inputClass} /></Field>
      <Field label="Slug (a-z, 0-9, dấu gạch ngang)"><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={inputClass} /></Field>
      <Field label="Biểu tượng"><input name="icon" required defaultValue="🏅" maxLength={12} className={inputClass} /></Field>
      <Field label="Độ hiếm"><select name="rarity" value={rarity} onChange={(event) => setRarity(event.target.value)} className={inputClass}>{ACHIEVEMENT_RARITIES.map((item) => <option key={item} value={item}>{rarityNames[item]}</option>)}</select></Field>
      <Field label="Điều kiện mở khóa"><select value={trigger} onChange={(event) => setTrigger(event.target.value)} className={inputClass}>{ACHIEVEMENT_TRIGGERS.map((item) => <option key={item} value={item}>{triggerNames[item]}</option>)}</select></Field>
      <Field label={trigger === "HEURISTIC_SCORE" ? "Mốc phần trăm (%)" : trigger === "WRONG_ANSWERS" ? "Số lượt WA cần đạt" : trigger === "CE_STREAK" ? "Số lượt CE liên tiếp" : trigger === "RANK_POINTS" ? "Mốc điểm rank cần đạt" : "Mốc cần đạt"}><input name="threshold" type="number" min={trigger === "RANK_POINTS" ? -1000000 : 1} max={trigger === "HEURISTIC_SCORE" ? 100 : 1000000} required defaultValue={trigger === "HEURISTIC_SCORE" ? 90 : trigger === "CE_STREAK" ? 10 : 1} className={inputClass} /></Field>
      {trigger === "HEURISTIC_SCORE" && <p className="self-end pb-2 text-xs text-[var(--muted)]">Tỷ lệ điểm đạt được trên tổng điểm của bài, từ 1% đến 100%.</p>}
      {(trigger === "PROBLEM_AC" || trigger === "HEURISTIC_SCORE") && <Field label={trigger === "PROBLEM_AC" ? "Slug bài tập" : "Slug bài heuristic (để trống = mọi bài heuristic)"}><input name="problemSlug" required={trigger === "PROBLEM_AC"} className={inputClass} /></Field>}
      <Field label="Mô tả"><textarea name="description" required maxLength={300} rows={2} className={inputClass} /></Field>
    </div>
    {rarity === "SECRET" && <p className="text-sm text-fuchsia-800">Thành tựu Secret sẽ được ẩn cho đến khi người dùng đạt điều kiện mở khóa.</p>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={colorEnabled} onChange={(event) => setColorEnabled(event.target.checked)} />Cho phép dùng màu thành tựu cho tên</label>
    {colorEnabled && <Field label="Màu tên"><select name="nameColor" className={inputClass}>{Object.keys(ACHIEVEMENT_COLOR_CLASSES).map((color) => <option key={color} value={color}>{color}</option>)}</select></Field>}
    {message && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-rose-700" : "text-emerald-700"}`}>{message}</p>}
    <button disabled={pending} className="rounded-lg bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Đang tạo..." : "Tạo thành tựu"}</button>
  </form>;
}

const inputClass = "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5 text-sm font-medium text-[var(--ink)]"><span>{label}</span>{children}</label>; }
