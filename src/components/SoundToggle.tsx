"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import {
  isSoundMuted,
  setSoundMuted,
  getSoundVolume,
  setSoundVolume,
  getCustomSound,
  setCustomSound,
  playSound,
  SOUND_CHANGE_EVENT,
} from "@/lib/sound";

function subscribeToSoundChanges(callback: () => void) {
  window.addEventListener(SOUND_CHANGE_EVENT, callback);
  return () => window.removeEventListener(SOUND_CHANGE_EVENT, callback);
}

function getSoundSnapshot() {
  return isSoundMuted();
}

function getServerSoundSnapshot() {
  return false;
}

export function SoundToggle() {
  const subscribe = useCallback(subscribeToSoundChanges, []);
  const muted = useSyncExternalStore(subscribe, getSoundSnapshot, getServerSoundSnapshot);

  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(80);
  const [hasCustomAc, setHasCustomAc] = useState(false);
  const [hasCustomWa, setHasCustomWa] = useState(false);
  const [acFileName, setAcFileName] = useState<string | null>(null);
  const [waFileName, setWaFileName] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const acInputRef = useRef<HTMLInputElement>(null);
  const waInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVolume(Math.round(getSoundVolume() * 100));
    setHasCustomAc(Boolean(getCustomSound("ac")));
    setHasCustomWa(Boolean(getCustomSound("wa")));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function notifyChange() {
    window.dispatchEvent(new Event(SOUND_CHANGE_EVENT));
  }

  function toggleMute() {
    const nextMuted = !muted;
    setSoundMuted(nextMuted);
    notifyChange();
  }

  function handleVolumeChange(val: number) {
    setVolume(val);
    setSoundVolume(val / 100);
    notifyChange();
  }

  function handleUploadAudio(type: "ac" | "wa", file: File) {
    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
      alert("Vui lòng chọn file âm thanh (.mp3, .wav, .ogg, .m4a)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert("Dung lượng file âm thanh tối đa là 4MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setCustomSound(type, result);
        if (type === "ac") {
          setHasCustomAc(true);
          setAcFileName(file.name);
        } else {
          setHasCustomWa(true);
          setWaFileName(file.name);
        }
        notifyChange();
      }
    };
    reader.readAsDataURL(file);
  }

  function handleResetSound(type: "ac" | "wa") {
    setCustomSound(type, null);
    if (type === "ac") {
      setHasCustomAc(false);
      setAcFileName(null);
    } else {
      setHasCustomWa(false);
      setWaFileName(null);
    }
    notifyChange();
  }

  return (
    <div className="relative" ref={panelRef}>
      <div className="flex items-center rounded-md border border-white/15 bg-transparent transition hover:bg-white/10">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
          title={muted ? "Âm thanh: Đang tắt (bấm để bật)" : "Âm thanh: Đang bật (bấm để tắt)"}
          className="inline-flex size-9 shrink-0 items-center justify-center text-[var(--cream)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
        >
          {muted ? (
            // 🔇 Muted icon
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
              <path
                d="M11 5 6 9H2v6h4l5 4V5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          ) : (
            // 🔊 Unmuted icon
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
              <path
                d="M11 5 6 9H2v6h4l5 4V5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15.54 8.46a5 5 0 0 1 0 7.07"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M19.07 4.93a10 10 0 0 1 0 14.14"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        {/* Small dropdown arrow button */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          title="Tùy chỉnh âm thanh & tải file âm thanh riêng"
          aria-label="Cài đặt âm thanh"
          className="px-1.5 py-2.5 text-[var(--cream)]/70 hover:text-white border-l border-white/10"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-3">
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--line)] pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
              Hiệu ứng âm thanh
            </span>
            <button
              type="button"
              onClick={toggleMute}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                muted
                  ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30"
                  : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
              }`}
            >
              {muted ? "Đang tắt tiếng" : "Đang bật"}
            </button>
          </div>

          {/* Volume slider */}
          <div className="mb-4 flex items-center justify-between text-xs text-[var(--navy)]">
            <span>Âm lượng: {volume}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-32 accent-[var(--teal)]"
            />
          </div>

          {/* AC sound section */}
          <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--background)] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">
                🎉 Âm thanh khi AC
              </span>
              <span className="text-[10px] text-[var(--muted)]">
                {hasCustomAc ? (acFileName || "File tùy chỉnh") : "Mặc định (Chime)"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => playSound("ac")}
                className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25"
              >
                ▶ Nghe thử
              </button>
              <button
                type="button"
                onClick={() => acInputRef.current?.click()}
                className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-[11px] text-[var(--navy)] hover:border-[var(--teal)]"
              >
                📁 Tải file (.mp3)
              </button>
              {hasCustomAc && (
                <button
                  type="button"
                  onClick={() => handleResetSound("ac")}
                  className="rounded-md px-1.5 py-1 text-[11px] text-rose-400 hover:underline"
                >
                  Đặt lại
                </button>
              )}
            </div>
            <input
              ref={acInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadAudio("ac", file);
              }}
            />
          </div>

          {/* WA / CE sound section */}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-400">
                ⚠️ Âm thanh khi WA / CE
              </span>
              <span className="text-[10px] text-[var(--muted)]">
                {hasCustomWa ? (waFileName || "File tùy chỉnh") : "Mặc định (Buzz)"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => playSound("wa")}
                className="rounded-md bg-rose-500/15 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/25"
              >
                ▶ Nghe thử
              </button>
              <button
                type="button"
                onClick={() => waInputRef.current?.click()}
                className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-[11px] text-[var(--navy)] hover:border-[var(--teal)]"
              >
                📁 Tải file (.mp3)
              </button>
              {hasCustomWa && (
                <button
                  type="button"
                  onClick={() => handleResetSound("wa")}
                  className="rounded-md px-1.5 py-1 text-[11px] text-rose-400 hover:underline"
                >
                  Đặt lại
                </button>
              )}
            </div>
            <input
              ref={waInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadAudio("wa", file);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
