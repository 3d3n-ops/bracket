/// <reference lib="webworker" />
import { deepEqual } from "./compare";
import { PY_PRELUDE, camelToSnake } from "./prelude";
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

// Harness that runs one test and returns a JSON string.
const HARNESS = `
import json, traceback

__camel_name = ""

def __run_test(entry_name, args_json, arg_kinds, result_kind):
    args = json.loads(args_json)
    conv = []
    for i, a in enumerate(args):
        k = arg_kinds[i] if i < len(arg_kinds) else "raw"
        if k == "list":
            conv.append(__array_to_list(a))
        elif k == "tree":
            conv.append(__array_to_tree(a))
        elif k == "list[]":
            conv.append([__array_to_list(x) for x in a])
        elif k == "tree[]":
            conv.append([__array_to_tree(x) for x in a])
        else:
            conv.append(a)
    fn = globals().get(entry_name)
    if fn is None:
        # LeetCode style: method on a Solution class (camelCase name).
        sol = globals().get("Solution")
        for cand in (entry_name, __camel_name):
            if sol is not None and hasattr(sol, cand):
                fn = getattr(sol(), cand)
                break
    if fn is None:
        raise NameError(f"Function '{entry_name}' is not defined (also looked for Solution.{__camel_name}).")
    out = fn(*conv)
    if result_kind == "list":
        out = __list_to_array(out)
    elif result_kind == "tree":
        out = __tree_to_array(out)
    return json.dumps(out, default=lambda o: list(o) if isinstance(o, (set, tuple)) else str(o))
`;

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
    py.runPython(HARNESS);
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
