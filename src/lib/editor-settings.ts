export type EditorTheme = "vs-dark" | "monokai" | "dracula" | "one-dark-pro" | "gruvbox";
export type EditorKeymap = "default" | "vim" | "emacs";
export type EditorFontSize = 12 | 13 | 14 | 15 | 16 | 18;

export const EDITOR_THEMES: { value: EditorTheme; label: string }[] = [
  { value: "vs-dark", label: "VS Dark (mặc định)" },
  { value: "monokai", label: "Monokai" },
  { value: "dracula", label: "Dracula" },
  { value: "one-dark-pro", label: "One Dark Pro" },
  { value: "gruvbox", label: "Gruvbox" },
];

export const EDITOR_KEYMAPS: { value: EditorKeymap; label: string }[] = [
  { value: "default", label: "Mặc định" },
  { value: "vim", label: "Vim" },
  { value: "emacs", label: "Emacs" },
];

export const EDITOR_FONT_SIZES: EditorFontSize[] = [12, 13, 14, 15, 16, 18];

const LS_THEME = "a2oj:editor:theme";
const LS_KEYMAP = "a2oj:editor:keymap";
const LS_FONTSIZE = "a2oj:editor:fontSize";

const VALID_THEMES = new Set<string>(EDITOR_THEMES.map((t) => t.value));
const VALID_KEYMAPS = new Set<string>(EDITOR_KEYMAPS.map((k) => k.value));
const VALID_FONTSIZES = new Set<number>(EDITOR_FONT_SIZES);

export function loadEditorTheme(): EditorTheme {
  if (typeof window === "undefined") return "vs-dark";
  try {
    const stored = window.localStorage.getItem(LS_THEME);
    if (stored && VALID_THEMES.has(stored)) return stored as EditorTheme;
  } catch {
    // ignore
  }
  return "vs-dark";
}

export function saveEditorTheme(theme: EditorTheme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_THEME, theme);
  } catch {
    // ignore
  }
}

export function loadEditorKeymap(): EditorKeymap {
  if (typeof window === "undefined") return "default";
  try {
    const stored = window.localStorage.getItem(LS_KEYMAP);
    if (stored && VALID_KEYMAPS.has(stored)) return stored as EditorKeymap;
  } catch {
    // ignore
  }
  return "default";
}

export function saveEditorKeymap(keymap: EditorKeymap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEYMAP, keymap);
  } catch {
    // ignore
  }
}

export function loadEditorFontSize(): EditorFontSize {
  if (typeof window === "undefined") return 14;
  try {
    const stored = window.localStorage.getItem(LS_FONTSIZE);
    if (stored) {
      const num = parseInt(stored, 10);
      if (VALID_FONTSIZES.has(num)) return num as EditorFontSize;
    }
  } catch {
    // ignore
  }
  return 14;
}

export function saveEditorFontSize(size: EditorFontSize): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_FONTSIZE, String(size));
  } catch {
    // ignore
  }
}

export const EDITOR_SETTINGS_EVENT = "a2oj-editor-settings-change";
