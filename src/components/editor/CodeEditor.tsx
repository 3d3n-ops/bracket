"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Language } from "@/lib/db/schema";

export function CodeEditor({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: string;
  onChange: (v: string) => void;
}) {
  const extensions = useMemo(() => [language === "python" ? python() : javascript()], [language]);
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={oneDark}
      height="100%"
      className="h-full text-[13px] [&_.cm-editor]:h-full [&_.cm-scroller]:font-mono"
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, tabSize: 2 }}
    />
  );
}
