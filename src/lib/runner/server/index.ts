import "server-only";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { DEEP_EQUAL_SRC } from "../compare";
import { JS_PRELUDE, PY_HARNESS, PY_PRELUDE } from "../prelude";
import type { RunRequest, RunResult } from "../types";

/**
 * Server-side twin of the browser runner so the tutor can execute code
 * itself: verify the tests it authors, check the learner's code on demand.
 * JS runs in a throwaway worker thread; Python in a persistent Pyodide worker
 * (loading takes a few seconds, so it is reused and reset between runs).
 */

const JS_TIMEOUT_MS = 5_000;
const PY_TIMEOUT_MS = 15_000;
const PY_BOOT_MS = 60_000;

export async function runOnServer(req: RunRequest): Promise<RunResult> {
  return req.language === "python" ? runPython(req) : runJavaScript(req);
}

/* ------------------------------------------------------------------ */
/* JavaScript                                                          */
/* ------------------------------------------------------------------ */

const JS_WORKER = `
const { parentPort, workerData } = require("node:worker_threads");
${DEEP_EQUAL_SRC}
const { source, tests, entryFn, io, language } = workerData;
const started = Date.now();
const logs = [], errs = [];
const fmt = (a) => a.map((x) => (typeof x === "string" ? x : safe(x))).join(" ");
const safe = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
const fakeConsole = { log: (...a) => logs.push(fmt(a)), info: (...a) => logs.push(fmt(a)), warn: (...a) => errs.push(fmt(a)), error: (...a) => errs.push(fmt(a)) };
const result = { ok: true, language, stdout: "", stderr: "", tests: [], durationMs: 0 };
try {
  const factory = new Function("console", ${JSON.stringify(JS_PRELUDE)} + "\\n" + source + "\\n;return { entry: typeof " + (entryFn || "undefined") + " === 'function' ? " + (entryFn || "undefined") + " : undefined, __arrayToList, __listToArray, __arrayToTree, __treeToArray };");
  const scope = factory(fakeConsole);
  if (tests.length) {
    if (!scope.entry) throw new Error("Function \`" + entryFn + "\` is not defined.");
    const kinds = (io && io.args) || [];
    const toRt = (v, k) => k === "list" ? scope.__arrayToList(v) : k === "tree" ? scope.__arrayToTree(v) : k === "list[]" ? v.map(scope.__arrayToList) : k === "tree[]" ? v.map(scope.__arrayToTree) : v;
    const fromRt = (v) => io && io.result === "list" ? scope.__listToArray(v) : io && io.result === "tree" ? scope.__treeToArray(v) : v;
    tests.forEach((t, i) => {
      const o = { name: t.name || ("Test " + (i + 1)), passed: false, expected: t.expected };
      try {
        const args = structuredClone(t.args).map((a, j) => toRt(a, kinds[j]));
        const actual = fromRt(scope.entry(...args));
        o.actual = actual === undefined ? null : actual;
        o.passed = deepEqual(actual, t.expected, !!t.unordered);
      } catch (e) { o.error = String((e && e.stack) || e); }
      result.tests.push(o);
    });
  }
} catch (e) { result.ok = false; result.error = String((e && e.stack) || e); }
result.stdout = logs.join("\\n"); result.stderr = errs.join("\\n"); result.durationMs = Date.now() - started;
parentPort.postMessage(result);
`;

function runJavaScript(req: RunRequest): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const worker = new Worker(JS_WORKER, {
      eval: true,
      workerData: { ...req, tests: req.tests ?? [] },
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      resolve(fail(req, started, `Timed out after ${JS_TIMEOUT_MS / 1000}s — infinite loop?`));
    }, JS_TIMEOUT_MS);
    worker.once("message", (r: RunResult) => {
      clearTimeout(timer);
      void worker.terminate();
      resolve(r);
    });
    worker.once("error", (e) => {
      clearTimeout(timer);
      resolve(fail(req, started, e.message));
    });
  });
}

/* ------------------------------------------------------------------ */
/* Python (persistent Pyodide worker)                                  */
/* ------------------------------------------------------------------ */

const PY_WORKER = `
const { parentPort, workerData } = require("node:worker_threads");
${DEEP_EQUAL_SRC}
const camelToSnake = (n) => n.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").toLowerCase();
const { loadPyodide } = require(workerData.pyodidePath);
let py, baseKeys;
const out = [], err = [];
const ready = loadPyodide({ indexURL: workerData.pyodidePath + "/" }).then((p) => {
  py = p;
  py.setStdout({ batched: (s) => out.push(s) });
  py.setStderr({ batched: (s) => err.push(s) });
  py.runPython(${JSON.stringify(PY_PRELUDE)});
  py.runPython(${JSON.stringify(PY_HARNESS)});
  baseKeys = new Set(py.globals.keys());
  parentPort.postMessage({ type: "ready" });
});
parentPort.on("message", async ({ id, req }) => {
  await ready;
  const started = Date.now();
  out.length = 0; err.length = 0;
  // Drop anything the previous run defined so runs are independent.
  for (const k of [...py.globals.keys()]) if (!baseKeys.has(k)) py.globals.delete(k);
  const result = { ok: true, language: "python", stdout: "", stderr: "", tests: [], durationMs: 0 };
  try {
    py.runPython(req.source);
    const tests = req.tests || [];
    if (tests.length) {
      const snake = camelToSnake(req.entryFn || "");
      const defined = (n) => py.runPython("callable(globals().get(" + JSON.stringify(n) + "))") === true;
      const name = defined(snake) ? snake : defined(req.entryFn || "") ? req.entryFn : snake;
      py.globals.set("__camel_name", req.entryFn || "");
      const runTest = py.globals.get("__run_test");
      const kinds = py.toPy((req.io && req.io.args) || []);
      tests.forEach((t, i) => {
        const o = { name: t.name || ("Test " + (i + 1)), passed: false, expected: t.expected };
        try {
          const actual = JSON.parse(runTest(name, JSON.stringify(t.args), kinds, (req.io && req.io.result) || "raw"));
          o.actual = actual; o.passed = deepEqual(actual, t.expected, !!t.unordered);
        } catch (e) { o.error = pyError(e); }
        result.tests.push(o);
      });
      runTest.destroy && runTest.destroy();
    }
  } catch (e) { result.ok = false; result.error = pyError(e); }
  result.stdout = out.join("\\n"); result.stderr = err.join("\\n"); result.durationMs = Date.now() - started;
  parentPort.postMessage({ type: "result", id, result });
});
function pyError(e) {
  const msg = String((e && e.message) || e);
  const i = msg.indexOf('File "<exec>"');
  return i >= 0 ? "Traceback (most recent call last):\\n  " + msg.slice(i) : msg;
}
`;

type Pending = { resolve: (r: RunResult) => void; timer: ReturnType<typeof setTimeout> };
let pyWorker: Worker | null = null;
let pyReady: Promise<void> | null = null;
const pending = new Map<number, Pending>();
let seq = 0;

function bootPython(): Promise<void> {
  if (pyWorker && pyReady) return pyReady;
  const worker = new Worker(PY_WORKER, {
    eval: true,
    workerData: { pyodidePath: path.join(process.cwd(), "node_modules", "pyodide") },
    resourceLimits: { maxOldGenerationSizeMb: 1024 },
  });
  pyWorker = worker;
  pyReady = new Promise<void>((resolve, reject) => {
    const boot = setTimeout(() => reject(new Error("Pyodide failed to start in time")), PY_BOOT_MS);
    worker.on("message", (m: { type: string; id?: number; result?: RunResult }) => {
      if (m.type === "ready") {
        clearTimeout(boot);
        resolve();
      } else if (m.type === "result" && m.id !== undefined) {
        const p = pending.get(m.id);
        if (p) {
          clearTimeout(p.timer);
          pending.delete(m.id);
          p.resolve(m.result!);
        }
      }
    });
    worker.on("error", (e) => {
      clearTimeout(boot);
      reject(e);
      killPython(`Python runner crashed: ${e.message}`);
    });
    worker.on("exit", () => {
      if (pyWorker === worker) {
        pyWorker = null;
        pyReady = null;
      }
    });
  });
  return pyReady;
}

function killPython(reason: string) {
  const w = pyWorker;
  pyWorker = null;
  pyReady = null;
  void w?.terminate();
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    p.resolve({ ok: false, language: "python", stdout: "", stderr: "", tests: [], durationMs: 0, error: reason });
    pending.delete(id);
  }
}

async function runPython(req: RunRequest): Promise<RunResult> {
  const started = Date.now();
  try {
    await bootPython();
  } catch (e) {
    return fail(req, started, (e as Error).message);
  }
  const worker = pyWorker!;
  const id = ++seq;
  return new Promise<RunResult>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // A hung Pyodide can't be interrupted; replace the worker.
      killPython("aborted");
      resolve(fail(req, started, `Timed out after ${PY_TIMEOUT_MS / 1000}s — infinite loop?`));
    }, PY_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    worker.postMessage({ id, req: { ...req, tests: req.tests ?? [] } });
  });
}

function fail(req: RunRequest, started: number, error: string): RunResult {
  return { ok: false, language: req.language, stdout: "", stderr: "", tests: [], durationMs: Date.now() - started, error };
}
