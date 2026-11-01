"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RankBadge } from "@/lib/ranks";

export function NameColorPreference({ mode, achievementId, achievements }: { mode: string; achievementId: string | null; achievements: RankBadge[] }) {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState(mode);
  const [selectedId, setSelectedId] = useState(achievementId ?? achievements[0]?.achievementId ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/profile/name-color", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: selectedMode, achievementId: selectedMode === "ACHIEVEMENT" ? selectedId : null }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "Không thể lưu lựa chọn."); return; }
      setMessage("Đã cập nhật màu tên."); router.refresh();
    } catch { setMessage("Không thể kết nối máy chủ."); }
    finally { setPending(false); }
  }

  return <div className="mt-4 rounded-lg border border-[var(--line)] p-3">
    <h3 className="text-sm font-semibold">Màu tên</h3>
    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-1.5"><input type="radio" checked={selectedMode === "RANK"} onChange={() => setSelectedMode("RANK")} />Theo rank</label>
      {achievements.length > 0 && <label className="flex items-center gap-1.5"><input type="radio" checked={selectedMode === "ACHIEVEMENT"} onChange={() => setSelectedMode("ACHIEVEMENT")} />Theo thành tựu</label>}
      {selectedMode === "ACHIEVEMENT" && achievements.length > 0 && <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="rounded-md border border-[var(--line)] bg-white px-2 py-1">{achievements.map((badge) => <option key={badge.achievementId} value={badge.achievementId}>{badge.icon} {badge.title}</option>)}</select>}
      <button type="button" onClick={save} disabled={pending || (selectedMode === "ACHIEVEMENT" && !achievements.length)} className="rounded-md bg-[var(--teal)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Đang lưu..." : "Lưu"}</button>
    </div>
    {message && <p role="status" className="mt-2 text-xs text-[var(--muted)]">{message}</p>}
    {achievements.length === 0 && <p className="mt-2 text-xs text-[var(--muted)]">Chưa có thành tựu màu tên nào được mở khóa.</p>}
  </div>;
}
