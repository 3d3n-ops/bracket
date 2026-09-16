"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/store/workspace-store";

/**
 * Voice I/O with two providers:
 *  - "server": Whisper STT + OpenAI TTS via /api/stt and /api/tts (needs OPENAI_API_KEY)
 *  - "browser": Web Speech API (SpeechRecognition + speechSynthesis), no keys
 * The provider is decided server-side and stored in the workspace store.
 */

/* ------------------------------------------------------------------ */
/* TTS: sentence queue with prefetch                                   */
/* ------------------------------------------------------------------ */

type QueueItem = { text: string; audio: Promise<Blob | null> | null };

// Module-level singleton so every component shares one playback queue.
const queue: QueueItem[] = [];
let playing = false;
let current: HTMLAudioElement | null = null;
let generation = 0;

async function fetchTts(text: string): Promise<Blob | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const prefs = ["Google US English", "Samantha", "Karen", "Daniel", "Microsoft Aria"];
  for (const p of prefs) {
    const v = voices.find((x) => x.name.includes(p));
    if (v) return v;
  }
  return voices.find((v) => v.lang.startsWith("en") && v.localService) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(stripForSpeech(text));
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.03;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

async function drain() {
  if (playing) return;
  playing = true;
  const gen = generation;
  useWorkspace.getState().setSpeaking(true);
  try {
    while (queue.length && gen === generation) {
      const item = queue.shift()!;
      if (!item.audio) {
        await speakBrowser(item.text);
        continue;
      }
      const blob = await item.audio;
      if (!blob || gen !== generation) continue;
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const a = new Audio(url);
        current = a;
        a.onended = () => resolve();
        a.onerror = () => resolve();
        a.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
      current = null;
    }
  } finally {
    playing = false;
    if (!queue.length) useWorkspace.getState().setSpeaking(false);
  }
}

export function useTtsQueue() {
  const enqueue = useCallback((text: string) => {
    const server = useWorkspace.getState().voice.tts === "server";
    queue.push({ text, audio: server ? fetchTts(text) : null });
    void drain();
  }, []);

  const stop = useCallback(() => {
    generation++;
    queue.length = 0;
    current?.pause();
    current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    useWorkspace.getState().setSpeaking(false);
  }, []);

  return { enqueue, stop };
}

function stripForSpeech(s: string) {
  return s
    .replace(/```[\s\S]*?```/g, " code block omitted. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#>]+/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* STT                                                                 */
/* ------------------------------------------------------------------ */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const transcript = useRef("");

  const start = useCallback(async () => {
    if (rec.current || recognition.current) return;
    const useBrowser = useWorkspace.getState().voice.stt === "browser";
    const Ctor = getRecognitionCtor();

    if (useBrowser && Ctor) {
      const r = new Ctor();
      r.lang = "en-US";
      r.continuous = true;
      r.interimResults = false;
      transcript.current = "";
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) transcript.current += (transcript.current ? " " : "") + res[0].transcript.trim();
        }
      };
      r.onerror = (e) => console.warn("speech recognition error", e.error);
      r.start();
      recognition.current = r;
      setRecording(true);
      return;
    }

    stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    const r = new MediaRecorder(stream.current, { mimeType: mime });
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.start(250);
    rec.current = r;
    setRecording(true);
  }, []);

  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const rg = recognition.current;
      if (rg) {
        rg.onend = () => {
          recognition.current = null;
          setRecording(false);
          resolve(transcript.current.trim());
        };
        rg.stop();
        return;
      }

      const r = rec.current;
      if (!r) return resolve("");
      r.onstop = async () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
        rec.current = null;
        setRecording(false);
        const blob = new Blob(chunks.current, { type: r.mimeType });
        if (blob.size < 1000) return resolve("");
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "speech.webm");
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          const data = (await res.json()) as { text?: string };
          resolve(data.text?.trim() ?? "");
        } catch {
          resolve("");
        } finally {
          setTranscribing(false);
        }
      };
      r.stop();
    });
  }, []);

  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      recognition.current?.stop();
    },
    [],
  );

  return { recording, transcribing, start, stop, supported: !!getRecognitionCtor() || typeof MediaRecorder !== "undefined" };
}
