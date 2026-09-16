"use client";

import { useEffect, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Language } from "@/lib/db/schema";
import { annotationsExtension, setAnnotationsEffect, type CodeAnnotation } from "@/lib/editor/annotations";

export function CodeEditor({
  language,
  value,
  onChange,
  annotations,
}: {
  language: Language;
  value: string;
  onChange: (v: string) => void;
  annotations: CodeAnnotation[];
}) {
  const view = useRef<EditorView | null>(null);
  const extensions = useMemo(() => [language === "python" ? python() : javascript(), annotationsExtension], [language]);

  // Push tutor annotations into the editor whenever they change.
  useEffect(() => {
    view.current?.dispatch({ effects: setAnnotationsEffect.of(annotations) });
  }, [annotations]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={(v) => {
        view.current = v;
        if (annotations.length) v.dispatch({ effects: setAnnotationsEffect.of(annotations) });
      }}
      extensions={extensions}
      theme={oneDark}
      height="100%"
      className="h-full text-[13px] [&_.cm-editor]:h-full [&_.cm-scroller]:font-mono"
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, tabSize: 2 }}
    />
  );
}
