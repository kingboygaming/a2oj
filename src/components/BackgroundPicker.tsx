"use client";

import { useEffect, useRef, useState } from "react";
import {
  BG_PRESETS,
  loadBgConfig,
  saveBgConfig,
  type BgConfig,
} from "@/lib/background-theme";

const BG_CHANGE_EVENT = "a2oj-bg-change";

export function BackgroundPicker() {
  const [open, setOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<BgConfig>({ type: "default" });
  const [customUrl, setCustomUrl] = useState("");
  const [customOpacity, setCustomOpacity] = useState(15);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cfg = loadBgConfig();
    setCurrentConfig(cfg);
    if (cfg.type === "image" && cfg.imageUrl) {
      setCustomUrl(cfg.imageUrl);
      setCustomOpacity(Math.round((cfg.imageOpacity ?? 0.15) * 100));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function applyAndSave(config: BgConfig) {
    setCurrentConfig(config);
    saveBgConfig(config);
    window.dispatchEvent(new CustomEvent(BG_CHANGE_EVENT, { detail: config }));
  }

  function handleSelectPreset(presetName: string) {
    const found = BG_PRESETS.find((p) => p.name === presetName);
    if (found) {
      applyAndSave({ ...found.config, preset: found.name });
    }
  }

  function handleApplyCustomImage(e: React.FormEvent) {
    e.preventDefault();
    if (!customUrl.trim()) return;
    applyAndSave({
      type: "image",
      imageUrl: customUrl.trim(),
      imageOpacity: customOpacity / 100,
    });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Tùy chỉnh giao diện nền"
        title="Đổi hình nền & hiệu ứng"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/15 text-[var(--cream)] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
      >
        {/* Palette icon */}
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
          <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r="1.5" fill="currentColor" />
          <path
            d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878.752.118 1.562-.432 1.562-1.2v-1.678c0-.663.537-1.2 1.2-1.2h1.6c4.529 0 8.2-3.671 8.2-8.2 0-5.302-4.925-9.6-11-9.6Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--line)] pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
              Hình nền & Hiệu ứng
            </span>
            <button
              onClick={() => handleSelectPreset("default")}
              className="text-[11px] text-[var(--muted)] hover:text-white hover:underline"
            >
              Mặc định
            </button>
          </div>

          {/* Presets grid */}
          <div className="grid grid-cols-2 gap-2">
            {BG_PRESETS.map((preset) => {
              const isActive =
                (currentConfig.preset === preset.name) ||
                (currentConfig.type === preset.config.type && !currentConfig.preset && preset.name === "default");
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset.name)}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition ${
                    isActive
                      ? "border-[var(--teal)] bg-[var(--teal)]/15 text-white font-medium ring-1 ring-[var(--teal)]"
                      : "border-[var(--line)] bg-[var(--background)] text-[var(--navy)] hover:border-white/30"
                  }`}
                >
                  <span className="text-sm">{preset.label.split(" ")[0]}</span>
                  <span className="truncate">{preset.label.split(" ").slice(1).join(" ") || preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom image URL */}
          <form onSubmit={handleApplyCustomImage} className="mt-4 border-t border-[var(--line)] pt-3">
            <label className="block text-xs font-medium text-[var(--navy)] mb-1">
              Ảnh nền cá nhân (URL)
            </label>
            <div className="flex gap-1.5">
              <input
                type="url"
                placeholder="https://... ảnh nền"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--navy)] outline-none focus:border-[var(--teal)]"
              />
              <button
                type="submit"
                className="rounded-md bg-[var(--surface-strong)] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20"
              >
                Áp dụng
              </button>
            </div>

            {/* Opacity slider */}
            <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>Độ mờ: {customOpacity}%</span>
              <input
                type="range"
                min="5"
                max="50"
                value={customOpacity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCustomOpacity(val);
                  if (currentConfig.type === "image") {
                    applyAndSave({
                      ...currentConfig,
                      imageOpacity: val / 100,
                    });
                  }
                }}
                className="w-24 accent-[var(--teal)]"
              />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
