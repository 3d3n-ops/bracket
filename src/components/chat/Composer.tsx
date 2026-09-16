"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/store/workspace-store";
import { useChatStream } from "./useChatStream";
import { VoiceButton } from "./VoiceButton";
import { useTtsQueue } from "@/lib/voice/useVoice";

export function Composer() {
  const [text, setText] = useState("");
  const streaming = useWorkspace((s) => s.streaming);
  const ttsEnabled = useWorkspace((s) => s.ttsEnabled);
  const setTtsEnabled = useWorkspace((s) => s.setTtsEnabled);
  const speaking = useWorkspace((s) => s.speaking);
  const { send, stop } = useChatStream();
  const tts = useTtsQueue();
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(
    (t: string) => {
      const v = t.trim();
      if (!v) return;
      setText("");
      void send(v);
    },
    [send],
  );

  // ⌘K focuses the composer from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="border-t border-white/10 bg-white/5 p-2">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit(text);
          }
        }}
        placeholder="Ask the tutor… (Enter to send, ⇧Enter for newline)"
        rows={2}
        className="w-full resize-none rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-indigo-400"
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <VoiceButton onTranscript={(t, autoSend) => (autoSend ? submit(t) : setText((x) => (x ? x + " " : "") + t))} />
        <button
          onClick={() => {
            if (ttsEnabled) tts.stop();
            setTtsEnabled(!ttsEnabled);
          }}
          className={`rounded-md px-2 py-1 text-xs ${ttsEnabled ? "bg-emerald-500/30 text-emerald-200" : "bg-white/10 text-zinc-300 hover:bg-white/15"}`}
          title="Read replies aloud"
        >
          {speaking ? "🔊 speaking" : ttsEnabled ? "🔊 voice on" : "🔇 voice off"}
        </button>
        <div className="flex-1" />
        {streaming ? (
          <button onClick={stop} className="rounded-md bg-red-500/80 px-3 py-1 text-xs font-medium text-white hover:bg-red-400">
            Stop
          </button>
        ) : (
          <button
            onClick={() => submit(text)}
            disabled={!text.trim()}
            className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-40"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
