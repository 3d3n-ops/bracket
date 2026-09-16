import type { Language, ProblemIO, TestCase } from "@/lib/db/schema";

export type TestOutcome = {
  name: string;
  passed: boolean;
  expected: unknown;
  actual?: unknown;
  error?: string;
};

export type RunResult = {
  ok: boolean;
  language: Language;
  stdout: string;
  stderr: string;
  tests: TestOutcome[];
  durationMs: number;
  /** Set when the run itself failed (syntax error, timeout, ...). */
  error?: string;
};

export type RunRequest = {
  language: Language;
  source: string;
  entryFn?: string | null;
  io?: ProblemIO | null;
  tests: TestCase[];
};

/** Messages exchanged with the worker. */
export type WorkerIn = { type: "run"; req: RunRequest };
export type WorkerOut =
  | { type: "result"; result: RunResult }
  | { type: "status"; message: string };
