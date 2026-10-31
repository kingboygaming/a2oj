"use client";

import { useEffect, useRef, useState } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  loadEditorTheme,
  loadEditorKeymap,
  loadEditorFontSize,
  type EditorTheme,
  EDITOR_SETTINGS_EVENT,
} from "@/lib/editor-settings";

const TEMPLATES: Record<string, string> = {
  CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`,
  PYTHON: `import sys

def main():
    data = sys.stdin.read().split()

if __name__ == "__main__":
    main()
`,
};

export function defaultSource(language: "CPP" | "PYTHON") {
  return TEMPLATES[language];
}

// ---------------------------------------------------------------------------
// Custom theme definitions
// ---------------------------------------------------------------------------
function defineCustomThemes(monaco: Monaco) {
  monaco.editor.defineTheme("monokai", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "75715e", fontStyle: "italic" },
      { token: "keyword", foreground: "f92672" },
      { token: "string", foreground: "e6db74" },
      { token: "number", foreground: "ae81ff" },
      { token: "type", foreground: "66d9ef", fontStyle: "italic" },
      { token: "function", foreground: "a6e22e" },
      { token: "variable", foreground: "f8f8f2" },
      { token: "operator", foreground: "f92672" },
    ],
    colors: {
      "editor.background": "#272822",
      "editor.foreground": "#f8f8f2",
      "editor.lineHighlightBackground": "#3e3d32",
      "editor.selectionBackground": "#49483e",
      "editorCursor.foreground": "#f8f8f0",
      "editorLineNumber.foreground": "#90908a",
      "editor.findMatchBackground": "#ffe792",
      "editor.findMatchHighlightBackground": "#ffe79280",
    },
  });

  monaco.editor.defineTheme("dracula", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6272a4", fontStyle: "italic" },
      { token: "keyword", foreground: "ff79c6" },
      { token: "string", foreground: "f1fa8c" },
      { token: "number", foreground: "bd93f9" },
      { token: "type", foreground: "8be9fd", fontStyle: "italic" },
      { token: "function", foreground: "50fa7b" },
      { token: "variable", foreground: "f8f8f2" },
      { token: "operator", foreground: "ff79c6" },
    ],
    colors: {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2",
      "editor.lineHighlightBackground": "#44475a",
      "editor.selectionBackground": "#44475a",
      "editorCursor.foreground": "#f8f8f2",
      "editorLineNumber.foreground": "#6272a4",
    },
  });

  monaco.editor.defineTheme("one-dark-pro", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5c6370", fontStyle: "italic" },
      { token: "keyword", foreground: "c678dd" },
      { token: "string", foreground: "98c379" },
      { token: "number", foreground: "d19a66" },
      { token: "type", foreground: "e5c07b", fontStyle: "italic" },
      { token: "function", foreground: "61afef" },
      { token: "variable", foreground: "e06c75" },
      { token: "operator", foreground: "56b6c2" },
    ],
    colors: {
      "editor.background": "#282c34",
      "editor.foreground": "#abb2bf",
      "editor.lineHighlightBackground": "#2c313a",
      "editor.selectionBackground": "#3e4451",
      "editorCursor.foreground": "#528bff",
      "editorLineNumber.foreground": "#4b5263",
    },
  });

  monaco.editor.defineTheme("gruvbox", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "928374", fontStyle: "italic" },
      { token: "keyword", foreground: "fb4934" },
      { token: "string", foreground: "b8bb26" },
      { token: "number", foreground: "d3869b" },
      { token: "type", foreground: "fabd2f", fontStyle: "italic" },
      { token: "function", foreground: "8ec07c" },
      { token: "variable", foreground: "ebdbb2" },
      { token: "operator", foreground: "fe8019" },
    ],
    colors: {
      "editor.background": "#282828",
      "editor.foreground": "#ebdbb2",
      "editor.lineHighlightBackground": "#3c3836",
      "editor.selectionBackground": "#504945",
      "editorCursor.foreground": "#ebdbb2",
      "editorLineNumber.foreground": "#7c6f64",
    },
  });
}

// ---------------------------------------------------------------------------
// Keymap helpers
// ---------------------------------------------------------------------------
type KeymapDisposable = { dispose: () => void };

async function applyKeymap(
  editorInstance: MonacoEditor.IStandaloneCodeEditor,
  keymap: string,
  statusBarElement: HTMLDivElement | null,
  activeModeRef: React.MutableRefObject<KeymapDisposable | null>,
) {
  // Dispose any existing active keymap mode (Vim or Emacs)
  if (activeModeRef.current) {
    try {
      activeModeRef.current.dispose();
    } catch (e) {
      console.warn("Failed to dispose previous keymap mode:", e);
    }
    activeModeRef.current = null;
  }

  if (statusBarElement) {
    statusBarElement.innerHTML = "";
    statusBarElement.style.display = "none";
  }

  if (keymap === "vim") {
    try {
      const { initVimMode } = await import("monaco-vim");
      if (statusBarElement) {
        statusBarElement.style.display = "block";
      }
      const vimMode = initVimMode(editorInstance, statusBarElement);
      activeModeRef.current = vimMode;
    } catch (err) {
      console.error("Failed to initialize Vim mode:", err);
    }
  } else if (keymap === "emacs") {
    try {
      const { EmacsExtension } = await import("monaco-emacs");
      const emacsMode = new EmacsExtension(editorInstance);
      emacsMode.start();
      activeModeRef.current = emacsMode;
    } catch (err) {
      console.error("Failed to initialize Emacs mode:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CodeEditor({
  language,
  value,
  onChange,
}: {
  language: "CPP" | "PYTHON";
  value: string;
  onChange: (value: string) => void;
}) {
  const [theme, setTheme] = useState<EditorTheme>(() => loadEditorTheme());
  const [fontSize, setFontSize] = useState<number>(() => loadEditorFontSize());

  // Refs to the live Monaco + editor instances so we can apply new keymap on change
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const keymapModeRef = useRef<KeymapDisposable | null>(null);
  const vimStatusRef = useRef<HTMLDivElement>(null);

  // Listen for settings changes dispatched by EditorSettingsPanel
  useEffect(() => {
    function handleSettingsChange() {
      setTheme(loadEditorTheme());
      setFontSize(loadEditorFontSize());

      const editor = editorRef.current;
      if (editor) {
        void applyKeymap(editor, loadEditorKeymap(), vimStatusRef.current, keymapModeRef);
      }
    }

    window.addEventListener(EDITOR_SETTINGS_EVENT, handleSettingsChange);
    return () => window.removeEventListener(EDITOR_SETTINGS_EVENT, handleSettingsChange);
  }, []);

  // Cleanup active keymap mode on unmount
  useEffect(() => {
    return () => {
      if (keymapModeRef.current) {
        try {
          keymapModeRef.current.dispose();
        } catch {}
        keymapModeRef.current = null;
      }
    };
  }, []);

  function handleMount(
    editorInstance: MonacoEditor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) {
    monacoRef.current = monaco;
    editorRef.current = editorInstance;

    defineCustomThemes(monaco);

    // Apply the stored theme (must be defined before setting)
    monaco.editor.setTheme(loadEditorTheme());

    void applyKeymap(editorInstance, loadEditorKeymap(), vimStatusRef.current, keymapModeRef);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)]">
      <Editor
        height="460px"
        theme={theme}
        loading={
          <div className="flex h-[460px] items-center justify-center text-xs text-[var(--muted)]">
            Đang tải editor...
          </div>
        }
        language={language === "CPP" ? "cpp" : "python"}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: fontSize,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
        }}
      />
      <div
        ref={vimStatusRef}
        className="hidden border-t border-white/10 bg-[#0d1525] px-3 py-1 font-mono text-xs text-sky-300"
      />
    </div>
  );
}
