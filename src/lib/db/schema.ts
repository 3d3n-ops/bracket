import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Shared JSON shapes                                                  */
/* ------------------------------------------------------------------ */

export type Language = "javascript" | "python";

export type StarterCode = Partial<Record<Language, string>>;

export type TestCase = {
  name?: string;
  /** Positional arguments passed to the entry function. */
  args: unknown[];
  expected: unknown;
  /** If true, compare as unordered collections (e.g. any valid ordering). */
  unordered?: boolean;
};

export type EditorState = { language: Language; source: string };

/** How the test harness converts JSON test data to/from runtime structures. */
export type IoKind = "raw" | "list" | "tree" | "list[]" | "tree[]";
export type ProblemIO = { args: IoKind[]; result: IoKind };

export type MemoryKind =
  | "weakness"
  | "strength"
  | "preference"
  | "progress"
  | "fact";

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ProblemSource = "seed" | "leetcode" | "tutor";

export const problems = pgTable("problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["dsa", "system_design"] }).notNull(),
  /** Where the problem came from: our seed bank, a LeetCode import, or a tutor-authored exercise. */
  source: text("source").$type<ProblemSource>().notNull().default("seed"),
  /** External reference (LeetCode title slug) and canonical URL when imported. */
  externalId: text("external_id"),
  url: text("url"),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull(),
  category: text("category").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  promptMd: text("prompt_md").notNull(),
  starterCode: jsonb("starter_code").$type<StarterCode>().notNull().default({}),
  entryFn: text("entry_fn"),
  io: jsonb("io").$type<ProblemIO>(),
  tests: jsonb("tests").$type<TestCase[]>().notNull().default([]),
  hints: jsonb("hints").$type<string[]>().notNull().default([]),
  solutionMd: text("solution_md"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    problemId: uuid("problem_id").references(() => problems.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** problem: seeded/imported problem · learn: topic-driven lesson · freestyle: open-ended. */
    mode: text("mode", { enum: ["problem", "learn", "freestyle"] }).notNull().default("problem"),
    /** Learn-mode topic; null means "surprise me". */
    topic: text("topic"),
    status: text("status", { enum: ["active", "closed"] }).notNull().default("active"),
    boardSnapshot: jsonb("board_snapshot"),
    code: jsonb("code").$type<EditorState>(),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId, t.updatedAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    /** Anthropic content blocks, stored verbatim so history round-trips exactly. */
    content: jsonb("content").notNull(),
    /** Plain-text form of what the user typed (without injected context), for display. */
    displayText: text("display_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("messages_session_idx").on(t.sessionId, t.createdAt)],
);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["weakness", "strength", "preference", "progress", "fact"],
    })
      .$type<MemoryKind>()
      .notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    sourceSessionId: uuid("source_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  },
  (t) => [
    index("memories_user_idx").on(t.userId, t.createdAt),
    index("memories_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    problemId: uuid("problem_id").references(() => problems.id, { onDelete: "set null" }),
    language: text("language").$type<Language>().notNull(),
    source: text("source").notNull(),
    passed: integer("passed").notNull(),
    total: integer("total").notNull(),
    allPassed: boolean("all_passed").notNull(),
    ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("attempts_session_idx").on(t.sessionId, t.ranAt)],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  problem: one(problems, { fields: [sessions.problemId], references: [problems.id] }),
  messages: many(messages),
  attempts: many(attempts),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
}));

export const attemptsRelations = relations(attempts, ({ one }) => ({
  session: one(sessions, { fields: [attempts.sessionId], references: [sessions.id] }),
  problem: one(problems, { fields: [attempts.problemId], references: [problems.id] }),
}));

export type Problem = typeof problems.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
