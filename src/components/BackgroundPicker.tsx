"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BG_PRESETS,
  getBgConfigSnapshot,
  getServerBgConfigSnapshot,
  saveBgConfig,
  subscribeToBgConfig,
  type BgConfig,
} from "@/lib/background-theme";

export function BackgroundPicker() {
  const [open, setOpen] = useState(false);
  const currentConfig = useSyncExternalStore(
    subscribeToBgConfig,
    getBgConfigSnapshot,
    getServerBgConfigSnapshot,
  );
  const [customUrlDraft, setCustomUrlDraft] = useState<string | null>(null);
  const [customOpacityDraft, setCustomOpacityDraft] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const customUrl =
    customUrlDraft ??
    (currentConfig.type === "image" &&
    currentConfig.imageUrl &&
    !currentConfig.imageUrl.startsWith("data:")
      ? currentConfig.imageUrl
      : "");
  const customOpacity =
    customOpacityDraft ??
    (currentConfig.type === "image"
      ? Math.round((currentConfig.imageOpacity ?? 0.15) * 100)
      : 15);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    try {
      saveBgConfig(config);
      setSaveError("");
      if (config.type !== "image") {
        setCustomUrlDraft(null);
        setCustomOpacityDraft(null);
      }
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Không thể lưu giao diện.",
      );
    }
  }

  function handleSelectPreset(presetName: string) {
    const found = BG_PRESETS.find((p) => p.name === presetName);
    if (found) {
      applyAndSave({ ...found.config, preset: found.name });
    }
  }

  function handleApplyCustomImageUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!customUrl.trim()) return;
    applyAndSave({
      type: "image",
      imageUrl: customUrl.trim(),
      imageOpacity: customOpacity / 100,
    });
  }

  // Tải file ảnh trực tiếp từ máy (PNG, JPG, WEBP...)
  function handleImageFileUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file hình ảnh (PNG, JPG, WebP, GIF...)");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        setIsUploading(false);
        return;
      }

      // Nén & tối ưu kích thước ảnh để đảm bảo vừa bộ nhớ localStorage
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width / height > MAX_WIDTH / MAX_HEIGHT) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
          applyAndSave({
            type: "image",
            imageUrl: compressedDataUrl,
            imageOpacity: customOpacity / 100,
          });
        }
        setIsUploading(false);
      };
      img.onerror = () => {
        setIsUploading(false);
        alert("Không thể tải hình ảnh này.");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
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
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--line)] pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
              Hình nền & Hiệu ứng
            </span>
            <button
              onClick={() => handleSelectPreset("default")}
              className="text-[11px] text-[var(--muted)] hover:text-white hover:underline"
            >
              Đặt lại mặc định
            </button>
          </div>

          {/* Presets grid */}
          <div className="grid grid-cols-2 gap-2">
            {BG_PRESETS.map((preset) => {
              const isActive =
                currentConfig.preset === preset.name ||
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

          {/* Custom image upload & URL */}
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[var(--navy)]">
                Ảnh nền tùy chỉnh (PNG, JPG...)
              </label>
              {currentConfig.type === "image" && (
                <span className="text-[10px] text-emerald-400 font-medium">✓ Đang áp dụng</span>
              )}
            </div>

            {/* Upload file button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-md border border-[var(--line)] bg-[var(--background)] py-2 text-center text-xs font-medium text-[var(--navy)] hover:border-[var(--teal)] transition disabled:opacity-50"
              >
                {isUploading ? "Đang xử lý ảnh..." : "📁 Tải ảnh từ máy tính"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFileUpload(file);
                }}
              />
              {currentConfig.type === "image" && (
                <button
                  type="button"
                  onClick={() => handleSelectPreset("default")}
                  title="Xóa hình nền tùy chỉnh"
                  className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-300 hover:bg-rose-500/20"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Or enter URL */}
            <form onSubmit={handleApplyCustomImageUrl} className="mt-2.5 flex gap-1.5">
              <input
                type="url"
                placeholder="Hoặc dán URL link ảnh..."
                value={customUrl}
                onChange={(e) => setCustomUrlDraft(e.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--navy)] outline-none focus:border-[var(--teal)]"
              />
              <button
                type="submit"
                className="rounded-md bg-[var(--surface-strong)] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 shrink-0"
              >
                Áp dụng
              </button>
            </form>

            {/* Opacity slider */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>Độ mờ nền: {customOpacity}%</span>
              <input
                type="range"
                min="5"
                max="60"
                value={customOpacity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCustomOpacityDraft(val);
                  if (currentConfig.type === "image") {
                    applyAndSave({
                      ...currentConfig,
                      imageOpacity: val / 100,
                    });
                  }
                }}
                className="w-28 accent-[var(--teal)]"
              />
            </div>
            {saveError && (
              <p role="alert" className="mt-2 text-xs text-red-500">
                {saveError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
