"use client";

import Editor from "@monaco-editor/react";

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

export function CodeEditor({
  language,
  value,
  onChange,
}: {
  language: "CPP" | "PYTHON";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)]">
      <Editor
        height="460px"
        theme="vs-dark"
        loading={
          <div className="flex h-[460px] items-center justify-center text-xs text-[var(--muted)]">
            Đang tải editor...
          </div>
        }
        language={language === "CPP" ? "cpp" : "python"}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
        }}
      />
    </div>
  );
}
