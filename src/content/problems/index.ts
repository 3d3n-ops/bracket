import { arraysAndStrings } from "./dsa/arrays-strings";
import { structures } from "./dsa/structures";
import { systemDesign } from "./system-design";
import type { ProblemSeed } from "./types";

export const allProblems: ProblemSeed[] = [...arraysAndStrings, ...structures, ...systemDesign];
export type { ProblemSeed };
