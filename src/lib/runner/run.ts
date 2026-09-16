"use client";

import type { RunRequest, RunResult, WorkerIn, WorkerOut } from "./types";

const TIMEOUT_MS: Record<RunRequest["language"], number> = {
  javascript: 10_000,
  python: 90_000, // includes first-time Pyodide download
};

// Reuse the Python worker across runs so Pyodide is only loaded once.
let pyWorker: Worker | null = null;

function makeWorker(language: RunRequest["language"]) {
  if (language === "python") {
    pyWorker ??= new Worker(new URL("./py.worker.ts", import.meta.url));
    return pyWorker;
  }
  return new Worker(new URL("./js.worker.ts", import.meta.url));
}

export function runCode(req: RunRequest, onStatus?: (s: string) => void): Promise<RunResult> {
  return new Promise((resolve) => {
    const worker = makeWorker(req.language);
    const started = performance.now();

    const finish = (result: RunResult) => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      if (req.language === "javascript") worker.terminate();
      resolve(result);
    };

    const timer = setTimeout(() => {
      // Kill the worker; a hung Python worker is recreated next run.
      worker.terminate();
      if (worker === pyWorker) pyWorker = null;
      finish({
        ok: false,
        language: req.language,
        stdout: "",
        stderr: "",
        tests: [],
        durationMs: Math.round(performance.now() - started),
        error: `Timed out after ${TIMEOUT_MS[req.language] / 1000}s — infinite loop?`,
      });
    }, TIMEOUT_MS[req.language]);

    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      if (e.data.type === "status") onStatus?.(e.data.message);
      else finish(e.data.result);
    };
    worker.onerror = (e) => {
      if (worker === pyWorker) pyWorker = null;
      finish({
        ok: false,
        language: req.language,
        stdout: "",
        stderr: "",
        tests: [],
        durationMs: Math.round(performance.now() - started),
        error: e.message || "Worker crashed",
      });
    };

    const msg: WorkerIn = { type: "run", req };
    worker.postMessage(msg);
  });
}
