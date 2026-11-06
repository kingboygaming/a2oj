"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Markdown } from "@/components/Markdown";
import {
  emptyRoadmapProgress,
  getRoadmapTrack,
  parseRoadmapProgress,
  roadmapProgressStorageKey,
  type RoadmapProgress,
  type RoadmapTrackId,
} from "@/lib/roadmap-progress";

type LessonStage = {
  id: string;
  sortOrder: number;
  level: string;
  title: string;
  description: string;
  topics: string[];
  content: string;
  checkpoint: string;
  resources: { label: string; href: string }[];
};

const trackNames: Record<RoadmapTrackId, string> = {
  basic: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

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
    return localStorage.getItem(roadmapProgressStorageKey);
  } catch {
    return null;
  }
}

export function RoadmapLesson({
  stages,
  currentStageId,
  isAdmin,
}: {
  stages: LessonStage[];
  currentStageId: string;
  isAdmin: boolean;
}) {
  const [fallbackProgress, setFallbackProgress] = useState<RoadmapProgress>({ ...emptyRoadmapProgress });
  const storedProgress = useSyncExternalStore(subscribeToProgress, getProgressSnapshot, () => null);
  const progress = parseRoadmapProgress(storedProgress) ?? fallbackProgress;
  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);
  const stage = stages[currentIndex];
  const track = getRoadmapTrack(stage.level);
  const trackStages = useMemo(
    () => stages.filter((item) => getRoadmapTrack(item.level) === track),
    [stages, track],
  );
  const completedIds = progress[track];
  const completedInTrack = completedIds.filter((id) => trackStages.some((item) => item.id === id)).length;
  const nextStage = stages[currentIndex + 1];
  const previousStage = stages[currentIndex - 1];
  const isCompleted = completedIds.includes(stage.id);

  function completeAndContinue() {
    if (isCompleted) return;
    const nextProgress = {
      ...progress,
      [track]: [...completedIds, stage.id],
    };
    setFallbackProgress(nextProgress);
    try {
      localStorage.setItem(roadmapProgressStorageKey, JSON.stringify(nextProgress));
      window.dispatchEvent(new Event("roadmap-progress-change"));
    } catch {
      // Keep progress in component state if browser storage is unavailable.
    }
  }

  return (
    <div className="roadmap-page roadmap-study-page">
      <div className="roadmap-shell">
        <header className="roadmap-study-header">
          <Link href="/wiki/roadmap" className="roadmap-back-link">← Tất cả lộ trình</Link>
          <div className="roadmap-study-heading">
            <div>
              <p className="roadmap-study-eyebrow">{trackNames[track]} · Bước {currentIndex + 1} / {stages.length}</p>
              <h1>{stage.title}</h1>
              <p className="roadmap-study-description">{stage.description}</p>
            </div>
            {isAdmin && (
              <Link href={`/wiki/roadmap/${stage.id}/edit`} className="roadmap-admin-link">
                Sửa bài học <span aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
        </header>

        <div className="roadmap-study-layout">
          <aside className="roadmap-study-sidebar" aria-label="Danh sách bài học trong lộ trình">
            <div className="roadmap-sidebar-heading">
              <div>
                <p className="roadmap-study-eyebrow">LỘ TRÌNH HỌC</p>
                <h2>Các bài học</h2>
              </div>
              <span>{completedInTrack}/{trackStages.length}</span>
            </div>
            {(["basic", "intermediate", "advanced"] as const).map((trackId) => {
              const items = stages.filter((item) => getRoadmapTrack(item.level) === trackId);
              if (!items.length) return null;
              return (
                <section key={trackId} className="roadmap-sidebar-group">
                  <h3>{trackNames[trackId]}</h3>
                  <ol>
                    {items.map((item) => {
                      const done = progress[trackId].includes(item.id);
                      return (
                        <li key={item.id}>
                          <Link
                            href={`/wiki/roadmap/${item.id}`}
                            aria-current={item.id === stage.id ? "page" : undefined}
                            className={`roadmap-sidebar-item${item.id === stage.id ? " active" : ""}${done ? " done" : ""}`}
                          >
                            <span className="roadmap-sidebar-number">{done ? "✓" : stages.indexOf(item) + 1}</span>
                            <span>{item.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </aside>

          <main className="roadmap-study-main">
            <div className="roadmap-lesson-progress">
              <div className="roadmap-progress-top">
                <span className="roadmap-progress-label">Tiến độ {trackNames[track]}</span>
                <span className="roadmap-progress-number"><span>{completedInTrack}</span> / {trackStages.length}</span>
              </div>
              <div
                className="roadmap-progress-bar"
                role="progressbar"
                aria-label={`Tiến độ ${trackNames[track]}`}
                aria-valuemin={0}
                aria-valuemax={trackStages.length}
                aria-valuenow={completedInTrack}
              >
                <div className="roadmap-progress-fill" style={{ width: `${trackStages.length ? (completedInTrack / trackStages.length) * 100 : 0}%` }} />
              </div>
            </div>

            <section className="roadmap-lesson-card" aria-label="Nội dung bài học">
              <div className="roadmap-lesson-topics">
                <span>Trong bài này</span>
                <div className="roadmap-tags">
                  {stage.topics.map((topic) => <span key={topic}>{topic}</span>)}
                </div>
              </div>
              <div className="roadmap-lesson-content">
                <Markdown source={stage.content} />
              </div>
              <aside className="roadmap-lesson-checkpoint">
                <span aria-hidden="true">🎯</span>
                <p><strong>Mốc tự kiểm tra</strong>{stage.checkpoint}</p>
              </aside>
              {stage.resources.length > 0 && (
                <section className="roadmap-lesson-resources">
                  <h2>Tài liệu tham khảo</h2>
                  <div className="roadmap-resources">
                    {stage.resources.map((resource) => (
                      <a key={`${resource.href}-${resource.label}`} href={resource.href} target="_blank" rel="noreferrer">
                        {resource.label} ↗
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </section>

            <div className="roadmap-lesson-actions">
              {previousStage ? (
                <Link href={`/wiki/roadmap/${previousStage.id}`} className="roadmap-previous-link">
                  ← Bài trước
                </Link>
              ) : <span />}
              {nextStage ? (
                <Link
                  href={`/wiki/roadmap/${nextStage.id}`}
                  onClick={completeAndContinue}
                  className="roadmap-next-link"
                >
                  {isCompleted ? "Tiếp tục bài sau" : "Hoàn thành & học bài tiếp"} <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <Link href="/wiki/roadmap" onClick={completeAndContinue} className="roadmap-next-link">
                  {isCompleted ? "Hoàn tất lộ trình" : "Hoàn thành bài học"} <span aria-hidden="true">✓</span>
                </Link>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
