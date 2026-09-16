import type { ProblemIO, StarterCode, TestCase } from "@/lib/db/schema";

export type ProblemSeed = {
  slug: string;
  title: string;
  kind: "dsa" | "system_design";
  difficulty: "easy" | "medium" | "hard";
  category: string;
  tags: string[];
  promptMd: string;
  starterCode: StarterCode;
  /** Name of the function the test harness calls. */
  entryFn?: string;
  /** Defaults to all-"raw". Use "list"/"tree" to auto-build ListNode/TreeNode from arrays. */
  io?: ProblemIO;
  tests: TestCase[];
  hints: string[];
  solutionMd?: string;
};
