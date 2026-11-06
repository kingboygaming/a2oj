"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RoadmapResource } from "@/lib/roadmap-defaults";

export type RoadmapStageFormData = {
  id: string;
  sortOrder: number;
  level: string;
  title: string;
  description: string;
  topics: string[];
  checkpoint: string;
  resources: RoadmapResource[];
};

export function RoadmapStageForm({
  stage,
  initialSortOrder = 1,
}: {
  stage?: RoadmapStageFormData;
  initialSortOrder?: number;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const topics = String(form.get("topics") ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
    const resourceLines = String(form.get("resources") ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
    if (resourceLines.some((item) => {
      const separator = item.indexOf("|");
      return separator < 2 || !item.slice(separator + 1).trim();
    })) {
      setError("Mỗi tài liệu cần có định dạng Tên | URL.");
      setPending(false);
      return;
    }
    const resources = resourceLines.map((item) => {
      const [label, ...urlParts] = item.split("|");
      return { label: label.trim(), href: urlParts.join("|").trim() };
    });
    const payload = {
      sortOrder: Number(form.get("sortOrder")),
      level: form.get("level"),
      title: form.get("title"),
      description: form.get("description"),
      topics,
      checkpoint: form.get("checkpoint"),
      resources,
    };

    try {
      const response = await fetch(stage ? `/api/wiki/roadmap/${stage.id}` : "/api/wiki/roadmap", {
        method: stage ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không thể lưu chặng học.");
        return;
      }
      router.push("/wiki/roadmap/manage");
      router.refresh();
    } catch {
      setError("Không thể kết nối để lưu chặng học. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Thứ tự
          <input required name="sortOrder" type="number" min={1} max={999} defaultValue={stage?.sortOrder ?? initialSortOrder} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" />
        </label>
        <label className="text-sm font-medium">Cấp độ
          <select required name="level" defaultValue={
            stage?.level.toLocaleLowerCase("vi").includes("nâng cao") ? "Nâng cao"
              : stage?.level.toLocaleLowerCase("vi").includes("trung cấp") ? "Trung cấp"
                : "Cơ bản"
          } className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
            <option value="Cơ bản">Cơ bản</option>
            <option value="Trung cấp">Trung cấp</option>
            <option value="Nâng cao">Nâng cao</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">Tên chặng
        <input required name="title" minLength={2} maxLength={160} defaultValue={stage?.title} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">Mô tả
        <textarea required name="description" minLength={5} maxLength={500} rows={3} defaultValue={stage?.description} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">Chủ đề (mỗi dòng một chủ đề)
        <textarea required name="topics" rows={5} defaultValue={stage?.topics.join("\n")} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">Mốc tự kiểm tra
        <textarea required name="checkpoint" minLength={5} maxLength={500} rows={2} defaultValue={stage?.checkpoint} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">Tài liệu tham khảo (mỗi dòng: Tên | URL)
        <textarea name="resources" rows={4} defaultValue={stage?.resources.map((item) => `${item.label} | ${item.href}`).join("\n")} placeholder="VNOI Wiki | https://wiki.vnoi.info/" className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-sm" />
      </label>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <button disabled={pending} className="rounded-md bg-[var(--teal)] px-4 py-2 font-medium text-white disabled:opacity-60">
        {pending ? "Đang lưu..." : "Lưu chặng học"}
      </button>
    </form>
  );
}
