"use client";

import { useCallback, useEffect, useRef } from "react";
import { Tldraw, getSnapshot, loadSnapshot, type Editor, type TLComponents, type TLStoreSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { useWorkspace } from "@/lib/store/workspace-store";
import { LeftControls, RightControls } from "@/components/workspace/TopControls";

// Our session controls live in tldraw's own top-left / top-right UI slots so
// they never collide with its menus or style panel.
const components: TLComponents = { MenuPanel: LeftControls, SharePanel: RightControls };

const SAVE_DEBOUNCE_MS = 1500;

export function Board({ sessionId, initialSnapshot }: { sessionId: string; initialSnapshot: unknown }) {
  const setEditorRef = useWorkspace((s) => s.setEditorRef);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMount = useCallback(
    (editor: Editor) => {
      setEditorRef(editor);

      if (initialSnapshot && typeof initialSnapshot === "object") {
        try {
          loadSnapshot(editor.store, { document: initialSnapshot as TLStoreSnapshot });
        } catch (e) {
          console.warn("Could not restore board snapshot", e);
        }
      }
      editor.user.updateUserPreferences({ colorScheme: "dark" });

      const stop = editor.store.listen(
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const { document } = getSnapshot(editor.store);
            void fetch(`/api/sessions/${sessionId}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ boardSnapshot: document }),
              keepalive: true,
            });
          }, SAVE_DEBOUNCE_MS);
        },
        { scope: "document" },
      );
      return () => {
        stop();
        setEditorRef(null);
      };
    },
    [sessionId, initialSnapshot, setEditorRef],
  );

  useEffect(() => () => setEditorRef(null), [setEditorRef]);

  return (
    <div className="absolute inset-0">
      <Tldraw onMount={onMount} components={components} />
    </div>
  );
}
