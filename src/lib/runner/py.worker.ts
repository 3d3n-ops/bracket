/// <reference lib="webworker" />
import { deepEqual } from "./compare";
import { PY_HARNESS, PY_PRELUDE, camelToSnake } from "./prelude";
import type { RunResult, TestOutcome, WorkerIn, WorkerOut } from "./types";

// 0.28.x (Python 3.13) is the last line that loads inside a classic worker;
// 314+ requires a module worker, which Turbopack's worker bundling doesn't produce.
const PYODIDE_VERSION = "0.28.3";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type Pyodide = {
  runPython: (code: string) => unknown;
  globals: { get: (k: string) => unknown; set: (k: string, v: unknown) => void };
  setStdout: (o: { batched: (s: string) => void }) => void;
  setStderr: (o: { batched: (s: string) => void }) => void;
  toPy: (v: unknown) => unknown;
};
type PyodideModule = { loadPyodide: (opts: { indexURL: string }) => Promise<Pyodide> };

const post = (m: WorkerOut) => self.postMessage(m);
let pyodideP: Promise<Pyodide> | null = null;

function getPyodide() {
  if (!pyodideP) {
    post({ type: "status", message: "Loading Python runtime (first run only)…" });
    // Turbopack workers are classic workers: pull the CDN script in with
    // importScripts (referenced indirectly so the bundler leaves it alone).
    const load = (self as unknown as { importScripts: (u: string) => void }).importScripts;
    load(`${PYODIDE_BASE}pyodide.js`);
    const { loadPyodide } = self as unknown as PyodideModule;
    pyodideP = loadPyodide({ indexURL: PYODIDE_BASE });
  }
  return pyodideP;
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  if (e.data.type !== "run") return;
  const { source, tests, entryFn, io, language } = e.data.req;
  const started = performance.now();
  const out: string[] = [];
  const err: string[] = [];
  const result: RunResult = { ok: true, language, stdout: "", stderr: "", tests: [], durationMs: 0 };

  try {
    const py = await getPyodide();
    py.setStdout({ batched: (s) => out.push(s) });
    py.setStderr({ batched: (s) => err.push(s) });

    py.runPython(PY_PRELUDE);
    py.runPython(PY_HARNESS);
    py.runPython(source);

    if (tests.length) {
      const snake = camelToSnake(entryFn ?? "");
      const runTest = py.globals.get("__run_test") as (
        n: string,
        a: string,
        k: unknown,
        r: string,
      ) => string;
      const defined = (n: string) => py.runPython(`callable(globals().get(${JSON.stringify(n)}))`) === true;
      const name = defined(snake) ? snake : defined(entryFn ?? "") ? entryFn! : snake;
      py.globals.set("__camel_name", entryFn ?? "");
      const argKinds = py.toPy(io?.args ?? []);

      tests.forEach((t, i) => {
        const outcome: TestOutcome = { name: t.name ?? `Test ${i + 1}`, passed: false, expected: t.expected };
        try {
          const json = runTest(name, JSON.stringify(t.args), argKinds, io?.result ?? "raw");
          const actual = JSON.parse(json);
          outcome.actual = actual;
          outcome.passed = deepEqual(actual, t.expected, t.unordered);
        } catch (ex) {
          outcome.error = pyError(ex);
        }
        result.tests.push(outcome);
      });
    }
  } catch (ex) {
    result.ok = false;
    result.error = pyError(ex);
  }

  result.stdout = out.join("\n");
  result.stderr = err.join("\n");
  result.durationMs = Math.round(performance.now() - started);
  post({ type: "result", result });
};

function pyError(ex: unknown) {
  const msg = String((ex as Error)?.message ?? ex);
  // Trim Pyodide's internal frames; keep the user-facing traceback.
  const idx = msg.indexOf('File "<exec>"');
  return idx >= 0 ? "Traceback (most recent call last):\n  " + msg.slice(idx) : msg;
}
