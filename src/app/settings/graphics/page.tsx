"use client";

import { useGraphicsStore } from "@/components/world3d/engine/useGraphicsStore";
import type { GraphicsQuality } from "@/components/world3d/engine/GraphicsSettings";

const QUALITY_INFO: Record<GraphicsQuality, { label: string; desc: string; icon: string }> = {
  LOW: {
    label: "Thấp",
    desc: "Giảm shadow, vegetation, NPC. Phù hợp thiết bị yếu.",
    icon: "⚡",
  },
  MEDIUM: {
    label: "Trung bình",
    desc: "Shadow cơ bản, terrain đầy đủ, vegetation trung bình.",
    icon: "✨",
  },
  HIGH: {
    label: "Cao",
    desc: "Shadow chất lượng cao, vegetation dày, hiệu ứng đầy đủ.",
    icon: "🌟",
  },
};

export default function GraphicsSettingsPage() {
  const { quality, settings, setQuality } = useGraphicsStore();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-[var(--navy)]">Cài đặt đồ họa 3D</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Chọn cấu hình phù hợp với thiết bị của bạn. Thay đổi áp dụng ngay lập tức.
      </p>

      <div className="mt-6 grid gap-3">
        {(["LOW", "MEDIUM", "HIGH"] as const).map((level) => {
          const info = QUALITY_INFO[level];
          const active = quality === level;
          return (
            <button
              key={level}
              type="button"
              onClick={() => setQuality(level)}
              className={`flex items-start gap-4 rounded-xl border p-4 text-left transition ${
                active
                  ? "border-[var(--teal)] bg-[var(--teal)]/10"
                  : "border-[var(--line)] bg-[var(--paper)] hover:border-[var(--teal)]/50"
              }`}
            >
              <span className="text-2xl">{info.icon}</span>
              <div className="flex-1">
                <p className="font-bold text-[var(--navy)]">
                  {info.label}
                  {active && (
                    <span className="ml-2 rounded-full bg-[var(--teal)] px-2 py-0.5 text-xs text-white">
                      Đang dùng
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{info.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
        <h2 className="text-sm font-bold text-[var(--navy)]">Chi tiết cấu hình hiện tại</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <dt className="text-[var(--muted)]">Shadow</dt>
          <dd className="font-semibold text-[var(--navy)]">{settings.shadowEnabled ? `Bật (${settings.shadowMapSize}px)` : "Tắt"}</dd>
          <dt className="text-[var(--muted)]">Vegetation</dt>
          <dd className="font-semibold text-[var(--navy)]">{Math.round(settings.vegetationDensity * 100)}%</dd>
          <dt className="text-[var(--muted)]">NPC tối đa</dt>
          <dd className="font-semibold text-[var(--navy)]">{settings.maxNPCs}</dd>
          <dt className="text-[var(--muted)]">Khoảng nhìn</dt>
          <dd className="font-semibold text-[var(--navy)]">{settings.drawDistance}m</dd>
          <dt className="text-[var(--muted)]">Terrain segments</dt>
          <dd className="font-semibold text-[var(--navy)]">{settings.terrainSegments}x{settings.terrainSegments}</dd>
          <dt className="text-[var(--muted)]">Anti-alias</dt>
          <dd className="font-semibold text-[var(--navy)]">{settings.antialias ? "Bật" : "Tắt"}</dd>
          <dt className="text-[var(--muted)]">Post-processing</dt>
          <dd className="font-semibold text-[var(--navy)]">{settings.postProcessing ? "Bật" : "Tắt"}</dd>
        </dl>
      </div>
    </div>
  );
}
