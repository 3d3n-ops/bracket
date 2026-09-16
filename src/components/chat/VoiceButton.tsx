"use client";

import { useCallback, useEffect } from "react";
import { useRecorder } from "@/lib/voice/useVoice";
import { useWorkspace } from "@/lib/store/workspace-store";

/**
 * Push-to-talk microphone. Click to start, click again to stop and transcribe.
 * Hold Space (outside inputs) also records. In voice mode the transcript is
 * sent immediately and TTS is enabled so the exchange feels conversational.
 */
export function VoiceButton({ onTranscript }: { onTranscript: (text: string, autoSend: boolean) => void }) {
  const { recording, transcribing, start, stop } = useRecorder();
  const voiceMode = useWorkspace((s) => s.voiceMode);
  const setVoiceMode = useWorkspace((s) => s.setVoiceMode);
  const setTtsEnabled = useWorkspace((s) => s.setTtsEnabled);

  const finish = useCallback(async () => {
    const text = await stop();
    if (text) onTranscript(text, useWorkspace.getState().voiceMode);
  }, [stop, onTranscript]);

  const toggle = useCallback(() => {
    if (recording) void finish();
    else void start().catch((e) => console.warn("mic unavailable", e));
  }, [recording, finish, start]);

  // Hold-to-talk with Space when focus is not in a text field.
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isTyping() && !recording) {
        e.preventDefault();
        void start().catch(() => {});
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && recording && !isTyping()) {
        e.preventDefault();
        void finish();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [recording, start, finish]);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        disabled={transcribing}
        className={`rounded-md px-2 py-1 text-xs transition ${
          recording
            ? "animate-pulse bg-red-500 text-white"
            : transcribing
              ? "bg-white/10 text-zinc-400"
              : "bg-white/10 text-zinc-200 hover:bg-white/15"
        }`}
        title="Click or hold Space to talk"
      >
        {recording ? "● recording" : transcribing ? "… transcribing" : "🎤 talk"}
      </button>
      <button
        onClick={() => {
          const next = !voiceMode;
          setVoiceMode(next);
          if (next) setTtsEnabled(true);
        }}
        className={`rounded-md px-2 py-1 text-xs ${voiceMode ? "bg-indigo-500/40 text-indigo-100" : "bg-white/10 text-zinc-300 hover:bg-white/15"}`}
        title="Voice mode: auto-send transcripts and speak replies"
      >
        {voiceMode ? "voice mode on" : "voice mode"}
      </button>
    </div>
  );
}
