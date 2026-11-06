"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

type RoadmapStage = {
  id: string;
  level: string;
  title: string;
  description: string;
  topics: string[];
  checkpoint: string;
  resources: { label: string; href: string }[];
};

const tracks = [
  { id: "basic", label: "Cơ bản", icon: "🌱" },
  { id: "intermediate", label: "Trung cấp", icon: "⚡" },
  { id: "advanced", label: "Nâng cao", icon: "🔥" },
] as const;

type TrackId = (typeof tracks)[number]["id"];
type TrackProgress = Record<TrackId, string[]>;

const emptyProgress: TrackProgress = { basic: [], intermediate: [], advanced: [] };
const progressStorageKey = "cp-roadmap-progress-v1";

function subscribeToProgress(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("roadmap-progress-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("roadmap-progress-change", onChange);
  };
}

function getProgressSnapshot() {
  try {
    return localStorage.getItem(progressStorageKey);
  } catch {
    return null;
  }
}

function parseProgress(value: string | null): TrackProgress | null {
  if (!value) return null;
  try {
    const savedProgress: unknown = JSON.parse(value);
    if (!savedProgress || typeof savedProgress !== "object") return null;
    const progress = savedProgress as Record<string, unknown>;
    return {
      basic: Array.isArray(progress.basic) ? progress.basic.filter((id): id is string => typeof id === "string") : [],
      intermediate: Array.isArray(progress.intermediate) ? progress.intermediate.filter((id): id is string => typeof id === "string") : [],
      advanced: Array.isArray(progress.advanced) ? progress.advanced.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return null;
  }
}

function getTrack(level: string): TrackId {
  const normalizedLevel = level.trim().toLocaleLowerCase("vi");
  if (normalizedLevel.includes("nâng cao") || normalizedLevel.includes("advanced")) return "advanced";
  if (normalizedLevel.includes("trung cấp") || normalizedLevel.includes("intermediate")) return "intermediate";
  return "basic";
}

function getProgressLabel(percentage: number) {
  if (percentage === 0) return "Khởi động 🏁";
  if (percentage < 34) return "Vào guồng ⚡";
  if (percentage < 67) return "Cày rank 📈";
  if (percentage < 100) return "Sắp phá đảo 🔥";
  return "Hoàn thành! 🏆";
}

export function RoadmapView({
  stages,
  isAdmin,
}: {
  stages: RoadmapStage[];
  isAdmin: boolean;
}) {
  const [currentTrack, setCurrentTrack] = useState<TrackId>("basic");
  const [completedByTrack, setCompletedByTrack] = useState<Record<TrackId, string[]>>({
    ...emptyProgress,
  });
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const storedProgress = useSyncExternalStore(subscribeToProgress, getProgressSnapshot, () => null);
  const progress = parseProgress(storedProgress) ?? completedByTrack;

  const visibleStages = useMemo(
    () => stages.filter((stage) => getTrack(stage.level) === currentTrack),
    [currentTrack, stages],
  );
  const completedIds = progress[currentTrack];
  const completedCount = completedIds.filter((id) => visibleStages.some((stage) => stage.id === id)).length;
  const totalCount = visibleStages.length;
  const percentage = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const track = tracks.find((item) => item.id === currentTrack) ?? tracks[0];

  function toggleCompleted(stageId: string) {
    const nextProgress = {
      ...progress,
      [currentTrack]: progress[currentTrack].includes(stageId)
        ? progress[currentTrack].filter((id) => id !== stageId)
        : [...progress[currentTrack], stageId],
    };
    setCompletedByTrack(nextProgress);
    try {
      localStorage.setItem(progressStorageKey, JSON.stringify(nextProgress));
      window.dispatchEvent(new Event("roadmap-progress-change"));
    } catch {
      // Keep progress in component state if browser storage is unavailable.
    }
  }

  return (
    <div className="roadmap-page">
      <div className="roadmap-shell">
        <header className="roadmap-hero">
          <div className="roadmap-pill"><span className="roadmap-pulse" /> LẬP TRÌNH THI ĐẤU · A2OJ</div>
          <h1>Lộ trình học thuật toán</h1>
          <p>
            Từ những bước đầu tiên đến các chủ đề nâng cao. Chọn cấp độ, mở tài liệu tham khảo
            và đánh dấu từng chặng bạn đã chinh phục.
          </p>
          {isAdmin && (
            <Link href="/wiki/roadmap/manage" className="roadmap-admin-link">
              Quản lý lộ trình <span aria-hidden="true">→</span>
            </Link>
          )}
        </header>

        <div className="roadmap-topbar">
          <div className="roadmap-tabs" role="tablist" aria-label="Chọn cấp độ lộ trình">
            {tracks.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`roadmap-tab-${item.id}`}
                aria-selected={currentTrack === item.id}
                aria-controls="roadmap-track-panel"
                className={`roadmap-tab${currentTrack === item.id ? " active" : ""}`}
                onClick={() => {
                  setCurrentTrack(item.id);
                  setOpenStageId(null);
                }}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <section className="roadmap-progress" aria-label="Tiến độ cấp độ hiện tại">
            <div className="roadmap-progress-top">
              <div className="roadmap-progress-label">
                Tiến độ của bạn <span className="roadmap-level-badge">{getProgressLabel(percentage)}</span>
              </div>
              <div className="roadmap-progress-number">
                <span>{completedCount}</span> / {totalCount} bước
              </div>
            </div>
            <div
              className="roadmap-progress-bar"
              role="progressbar"
              aria-label={`Tiến độ ${track.label}`}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-valuenow={completedCount}
            >
              <div className="roadmap-progress-fill" style={{ width: `${percentage}%` }} />
            </div>
          </section>
        </div>

        <p className="roadmap-hint">
          Mở thẻ để xem tài liệu · Chọn vòng tròn ✓ để đánh dấu hoàn thành
        </p>

        <main
          id="roadmap-track-panel"
          className="roadmap-timeline"
          role="tabpanel"
          aria-labelledby={`roadmap-tab-${currentTrack}`}
        >
          {visibleStages.length === 0 ? (
            <p className="roadmap-empty">Chưa có chặng học ở cấp độ này.</p>
          ) : visibleStages.map((stage, index) => {
            const isCompleted = completedIds.includes(stage.id);
            const isOpen = openStageId === stage.id;
            return (
              <article
                key={stage.id}
                className={`roadmap-step${index % 2 ? " right" : " left"}${isCompleted ? " done" : ""}`}
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <section className={`roadmap-card${isOpen ? " open" : ""}`}>
                  <div className="roadmap-card-head">
                    <button
                      type="button"
                      className="roadmap-card-toggle"
                      aria-expanded={isOpen}
                      aria-controls={`roadmap-details-${stage.id}`}
                      onClick={() => setOpenStageId(isOpen ? null : stage.id)}
                    >
                      <span className="roadmap-step-index">Bước {index + 1} · {stage.level}</span>
                      <span className="roadmap-card-title">{stage.title}</span>
                    </button>
                    <button
                      type="button"
                      className="roadmap-check"
                      aria-label={`${isCompleted ? "Bỏ đánh dấu" : "Đánh dấu"} ${stage.title} ${isCompleted ? "chưa hoàn thành" : "hoàn thành"}`}
                      aria-pressed={isCompleted}
                      onClick={() => toggleCompleted(stage.id)}
                    >
                      ✓
                    </button>
                  </div>
                  <p className="roadmap-description">{stage.description}</p>
                  <div className="roadmap-tags">
                    {stage.topics.map((topic) => <span key={topic}>{topic}</span>)}
                  </div>
                  <div id={`roadmap-details-${stage.id}`} className="roadmap-details" aria-hidden={!isOpen} inert={!isOpen}>
                    <p className="roadmap-checkpoint">
                      <strong>Mốc tự kiểm tra:</strong> {stage.checkpoint}
                    </p>
                    <div className="roadmap-resources">
                      {stage.resources.map((resource) => (
                        <a key={`${resource.href}-${resource.label}`} href={resource.href} target="_blank" rel="noreferrer">
                          {resource.label} ↗
                        </a>
                      ))}
                      <Link href="/problems">Luyện bài trên A2OJ ↗</Link>
                    </div>
                  </div>
                </section>
                <div className="roadmap-dot" aria-label={isCompleted ? "Đã hoàn thành" : `Bước ${index + 1}`}>
                  {isCompleted ? "✓" : index + 1}
                </div>
              </article>
            );
          })}
        </main>
      </div>
    </div>
  );
}
