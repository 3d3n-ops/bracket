/// <reference lib="webworker" />
import { deepEqual } from "./compare";
import { JS_PRELUDE } from "./prelude";
import type { RunResult, TestOutcome, WorkerIn, WorkerOut } from "./types";

const post = (m: WorkerOut) => self.postMessage(m);

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  if (e.data.type !== "run") return;
  const { source, tests, entryFn, io, language } = e.data.req;
  const started = performance.now();
  const logs: string[] = [];
  const errs: string[] = [];

  const fmt = (args: unknown[]) =>
    args.map((a) => (typeof a === "string" ? a : safeJson(a))).join(" ");
  const fakeConsole = {
    log: (...a: unknown[]) => logs.push(fmt(a)),
    info: (...a: unknown[]) => logs.push(fmt(a)),
    warn: (...a: unknown[]) => errs.push(fmt(a)),
    error: (...a: unknown[]) => errs.push(fmt(a)),
  };

  const result: RunResult = { ok: true, language, stdout: "", stderr: "", tests: [], durationMs: 0 };

  try {
    // Evaluate prelude + user code in one function scope, then return the entry
    // function and the converters so the harness can use them.
    const factory = new Function(
      "console",
      `${JS_PRELUDE}\n${source}\n;return { entry: typeof ${entryFn || "undefined"} === "function" ? ${entryFn || "undefined"} : undefined, __arrayToList, __listToArray, __arrayToTree, __treeToArray };`,
    );
    const scope = factory(fakeConsole) as {
      entry?: (...a: unknown[]) => unknown;
      __arrayToList: (x: unknown) => unknown;
      __listToArray: (x: unknown) => unknown;
      __arrayToTree: (x: unknown) => unknown;
      __treeToArray: (x: unknown) => unknown;
    };

    if (tests.length) {
      if (!scope.entry) throw new Error(`Function \`${entryFn}\` is not defined.`);
      const argKinds = io?.args ?? [];
      const toRuntime = (v: unknown, kind?: string): unknown => {
        if (kind === "list") return scope.__arrayToList(v);
        if (kind === "tree") return scope.__arrayToTree(v);
        if (kind === "list[]") return (v as unknown[]).map(scope.__arrayToList);
        if (kind === "tree[]") return (v as unknown[]).map(scope.__arrayToTree);
        return v;
      };
      const fromRuntime = (v: unknown) =>
        io?.result === "list" ? scope.__listToArray(v) : io?.result === "tree" ? scope.__treeToArray(v) : v;

      tests.forEach((t, i) => {
        const name = t.name ?? `Test ${i + 1}`;
        const outcome: TestOutcome = { name, passed: false, expected: t.expected };
        try {
          const args = structuredClone(t.args).map((a, j) => toRuntime(a, argKinds[j]));
          const raw = scope.entry!(...args);
          const actual = fromRuntime(raw);
          outcome.actual = actual === undefined ? null : actual;
          outcome.passed = deepEqual(actual, t.expected, t.unordered);
        } catch (err) {
          outcome.error = String((err as Error)?.stack ?? err);
        }
        result.tests.push(outcome);
      });
    }
  } catch (err) {
    result.ok = false;
    result.error = String((err as Error)?.stack ?? err);
  }

  result.stdout = logs.join("\n");
  result.stderr = errs.join("\n");
  result.durationMs = Math.round(performance.now() - started);
  post({ type: "result", result });
};

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
