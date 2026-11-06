"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RoadmapResource } from "@/lib/roadmap-defaults";
import { getRoadmapTrack } from "@/lib/roadmap-progress";

export type RoadmapStageFormData = {
  id: string;
  sortOrder: number;
  parentId: string | null;
  level: string;
  title: string;
  description: string;
  topics: string[];
  content: string;
  checkpoint: string;
  resources: RoadmapResource[];
};

export function RoadmapStageForm({
  stage,
  parents,
  initialSortOrder = 1,
  initialParentId = "",
  initialLevel = "Cơ bản",
  allowParentSelection = true,
}: {
  stage?: RoadmapStageFormData;
  parents: { id: string; title: string; level: string }[];
  initialSortOrder?: number;
  initialParentId?: string;
  initialLevel?: string;
  allowParentSelection?: boolean;
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
      parentId: String(form.get("parentId") ?? "") || null,
      level: form.get("level"),
      title: form.get("title"),
      description: form.get("description"),
      topics,
      content: form.get("content"),
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
          <select required name="level" defaultValue={(() => {
            const level = stage?.level ?? initialLevel;
            const track = getRoadmapTrack(level);
            return track === "advanced" ? "Nâng cao" : track === "intermediate" ? "Trung cấp" : "Cơ bản";
          })()} className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
            <option value="Cơ bản">Cơ bản</option>
            <option value="Trung cấp">Trung cấp</option>
            <option value="Nâng cao">Nâng cao</option>
          </select>
        </label>
        <label className="text-sm font-medium">Nhánh lớn
          <select
            name="parentId"
            defaultValue={stage?.parentId ?? initialParentId}
            disabled={!allowParentSelection}
            onChange={(event) => {
              const parentTrack = event.currentTarget.selectedOptions[0]?.dataset.track;
              const levelSelect = event.currentTarget.form?.elements.namedItem("level");
              if (parentTrack && levelSelect instanceof HTMLSelectElement) {
                levelSelect.value = parentTrack;
              }
            }}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 disabled:opacity-60"
          >
            <option value="">Chặng lớn (không có chặng cha)</option>
            {parents.map((parent) => (
              <option
                key={parent.id}
                value={parent.id}
                data-track={
                  getRoadmapTrack(parent.level) === "advanced" ? "Nâng cao"
                    : getRoadmapTrack(parent.level) === "intermediate" ? "Trung cấp"
                      : "Cơ bản"
                }
              >
                {parent.title} · {parent.level}
              </option>
            ))}
          </select>
          {!allowParentSelection && <span className="mt-1 block text-xs text-[var(--muted)]">Chặng này đang có nhánh con; hãy chuyển nhánh con trước khi đổi cấp.</span>}
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
      <label className="block text-sm font-medium">Nội dung bài học (Markdown)
        <textarea required name="content" minLength={20} maxLength={30000} rows={18} defaultValue={stage?.content} placeholder={"## Mục tiêu\n\nGiới thiệu mục tiêu bài học...\n\n## Nội dung\n\nGiải thích các kiến thức chính tại đây."} className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-sm" />
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
