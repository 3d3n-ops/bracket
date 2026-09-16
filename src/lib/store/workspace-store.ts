import { create } from "zustand";
import type { Editor } from "tldraw";
import type { EditorState, Language, Problem, Session } from "@/lib/db/schema";
import type { RunResult } from "@/lib/runner/types";
import type { CodeAnnotation } from "@/lib/editor/annotations";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Tool activity shown inline while streaming (e.g. "drawing on board"). */
  tools?: string[];
  streaming?: boolean;
  error?: string;
};

type Panel = { x: number; y: number; w: number; h: number };

export type VoiceProvider = { stt: "server" | "browser"; tts: "server" | "browser" };

type WorkspaceState = {
  session: Session | null;
  problem: Problem | null;
  editorRef: Editor | null;

  editor: EditorState;
  /** Draft source per language so switching back and forth loses nothing. */
  drafts: Partial<Record<Language, string>>;
  lastRun: RunResult | null;
  running: boolean;
  /** Tutor review notes pinned to editor lines. */
  annotations: CodeAnnotation[];

  sidebarOpen: boolean;
  sidebarWidth: number; // px
  chatPanel: Panel;
  chatVisible: boolean;

  messages: ChatMessage[];
  streaming: boolean;

  voice: VoiceProvider;
  voiceMode: boolean;
  ttsEnabled: boolean;
  speaking: boolean;

  // actions
  init: (s: Session, p: Problem | null, msgs: ChatMessage[], voice: VoiceProvider) => void;
  setEditorRef: (e: Editor | null) => void;
  /** Swap the active problem (tutor exercise / LeetCode import) and reset the editor to its starter. */
  setProblem: (p: Problem, language?: Language) => void;
  setCode: (patch: Partial<EditorState>) => void;
  setLanguage: (l: Language) => void;
  resetCode: () => void;
  setLastRun: (r: RunResult | null) => void;
  setAnnotations: (a: CodeAnnotation[]) => void;
  setRunning: (v: boolean) => void;
  toggleSidebar: (v?: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setChatPanel: (p: Partial<Panel>) => void;
  toggleChat: (v?: boolean) => void;
  pushMessage: (m: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) => void;
  setStreaming: (v: boolean) => void;
  setVoiceMode: (v: boolean) => void;
  setTtsEnabled: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;
};

export const useWorkspace = create<WorkspaceState>((set) => ({
  session: null,
  problem: null,
  editorRef: null,
  editor: { language: "javascript", source: "" },
  drafts: {},
  lastRun: null,
  running: false,
  annotations: [],
  sidebarOpen: false,
  sidebarWidth: 0,
  chatPanel: { x: 24, y: 80, w: 400, h: 520 },
  chatVisible: true,
  messages: [],
  streaming: false,
  voice: { stt: "browser", tts: "browser" },
  voiceMode: false,
  ttsEnabled: false,
  speaking: false,

  init: (session, problem, messages, voice) =>
    set({
      session,
      problem,
      messages,
      voice,
      editor: session.code ?? {
        language: "javascript",
        source: problem?.starterCode?.javascript ?? "",
      },
      drafts: {},
      sidebarOpen: problem?.kind === "dsa",
      lastRun: null,
    }),
  setEditorRef: (editorRef) => set({ editorRef }),
  setProblem: (problem, preferred) =>
    set((s) => {
      const language = preferred ?? s.editor.language;
      const starter = problem.starterCode?.[language] ?? problem.starterCode?.javascript ?? "";
      return {
        problem,
        session: s.session ? { ...s.session, problemId: problem.id, title: problem.title } : s.session,
        editor: { language, source: starter },
        drafts: {},
        lastRun: null,
        annotations: [],
        sidebarOpen: true,
      };
    }),
  setCode: (patch) => set((s) => ({ editor: { ...s.editor, ...patch } })),
  setLanguage: (language) =>
    set((s) => {
      if (language === s.editor.language) return {};
      const drafts = { ...s.drafts, [s.editor.language]: s.editor.source };
      return {
        drafts,
        editor: { language, source: drafts[language] ?? s.problem?.starterCode?.[language] ?? "" },
        lastRun: null,
        annotations: [],
      };
    }),
  resetCode: () =>
    set((s) => ({
      editor: { language: s.editor.language, source: s.problem?.starterCode?.[s.editor.language] ?? "" },
      lastRun: null,
      annotations: [],
    })),
  setLastRun: (lastRun) => set({ lastRun }),
  setAnnotations: (annotations) => set({ annotations }),
  setRunning: (running) => set({ running }),
  toggleSidebar: (v) => set((s) => ({ sidebarOpen: v ?? !s.sidebarOpen })),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setChatPanel: (p) => set((s) => ({ chatPanel: { ...s.chatPanel, ...p } })),
  toggleChat: (v) => set((s) => ({ chatVisible: v ?? !s.chatVisible })),
  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m,
      ),
    })),
  setStreaming: (streaming) => set({ streaming }),
  setVoiceMode: (voiceMode) => set({ voiceMode }),
  setTtsEnabled: (ttsEnabled) => set({ ttsEnabled }),
  setSpeaking: (speaking) => set({ speaking }),
}));
