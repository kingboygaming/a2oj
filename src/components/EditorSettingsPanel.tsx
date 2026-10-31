"use client";

import { useEffect, useRef, useState } from "react";
import {
  EDITOR_THEMES,
  EDITOR_KEYMAPS,
  EDITOR_FONT_SIZES,
  type EditorTheme,
  type EditorKeymap,
  type EditorFontSize,
  loadEditorTheme,
  loadEditorKeymap,
  loadEditorFontSize,
  saveEditorTheme,
  saveEditorKeymap,
  saveEditorFontSize,
  EDITOR_SETTINGS_EVENT,
} from "@/lib/editor-settings";

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function EditorSettingsPanel() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<EditorTheme>("vs-dark");
  const [keymap, setKeymap] = useState<EditorKeymap>("default");
  const [fontSize, setFontSize] = useState<EditorFontSize>(14);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    setTheme(loadEditorTheme());
    setKeymap(loadEditorKeymap());
    setFontSize(loadEditorFontSize());
  }, []);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function dispatchChange() {
    window.dispatchEvent(new CustomEvent(EDITOR_SETTINGS_EVENT));
  }

  function handleThemeChange(value: EditorTheme) {
    setTheme(value);
    saveEditorTheme(value);
    dispatchChange();
  }

  function handleKeymapChange(value: EditorKeymap) {
    setKeymap(value);
    saveEditorKeymap(value);
    dispatchChange();
  }

  function handleFontSizeChange(value: EditorFontSize) {
    setFontSize(value);
    saveEditorFontSize(value);
    dispatchChange();
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Cài đặt editor"
        aria-label="Cài đặt editor"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1f2937] px-2.5 py-2 text-sm text-slate-300 outline-none transition hover:border-sky-400/40 hover:text-white focus:border-sky-400/60"
      >
        <GearIcon />
        <span className="hidden sm:inline text-xs">Cài đặt</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#1f2937] p-3 shadow-2xl shadow-black/50">
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Editor Settings
          </p>

          {/* Theme */}
          <label className="mb-2 block">
            <span className="mb-1 block text-xs text-slate-400">Theme</span>
            <select
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value as EditorTheme)}
              className="w-full rounded-md border border-white/10 bg-[#111827] px-2 py-1.5 text-xs text-white outline-none transition focus:border-sky-400/60"
            >
              {EDITOR_THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {/* Keymap */}
          <label className="mb-2 block">
            <span className="mb-1 block text-xs text-slate-400">Keymap</span>
            <select
              value={keymap}
              onChange={(e) => handleKeymapChange(e.target.value as EditorKeymap)}
              className="w-full rounded-md border border-white/10 bg-[#111827] px-2 py-1.5 text-xs text-white outline-none transition focus:border-sky-400/60"
            >
              {EDITOR_KEYMAPS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          {/* Font size */}
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Font size</span>
            <select
              value={fontSize}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10) as EditorFontSize)}
              className="w-full rounded-md border border-white/10 bg-[#111827] px-2 py-1.5 text-xs text-white outline-none transition focus:border-sky-400/60"
            >
              {EDITOR_FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
