/**
 * Thin client for LeetCode's public GraphQL endpoint. No auth needed for
 * problem search/content/daily challenge; premium problems come back with
 * `content: null` and `isPaidOnly: true`.
 */

const ENDPOINT = "https://leetcode.com/graphql";

export type LcDifficulty = "EASY" | "MEDIUM" | "HARD";

export type LcSummary = {
  id: string;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  paidOnly: boolean;
  acRate: number;
  tags: string[];
};

export type LcQuestion = {
  id: string;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  paidOnly: boolean;
  tags: { name: string; slug: string }[];
  contentHtml: string | null;
  exampleInputs: string[];
  metaData: LcMetaData | null;
  snippets: Partial<Record<"javascript" | "python3", string>>;
  hints: string[];
};

export type LcMetaData = {
  name: string;
  params: { name: string; type: string }[];
  return: { type: string };
  /** LeetCode's "design" problems (class-based) set this; we don't support them. */
  classname?: string;
};

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", referer: "https://leetcode.com", "user-agent": "bracket-ai/0.1" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`LeetCode responded ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error("LeetCode returned no data");
  return json.data;
}

export async function searchProblems(opts: {
  query?: string;
  tags?: string[];
  difficulty?: LcDifficulty;
  limit?: number;
}): Promise<{ total: number; problems: LcSummary[] }> {
  const filters: Record<string, unknown> = {};
  if (opts.query) filters.searchKeywords = opts.query;
  if (opts.tags?.length) filters.tags = opts.tags;
  if (opts.difficulty) filters.difficulty = opts.difficulty;

  const data = await gql<{
    list: { total: number; questions: { questionFrontendId: string; titleSlug: string; title: string; difficulty: LcSummary["difficulty"]; isPaidOnly: boolean; acRate: number; topicTags: { slug: string }[] }[] };
  }>(
    `query search($limit: Int, $filters: QuestionListFilterInput) {
      list: questionList(categorySlug: "algorithms", limit: $limit, skip: 0, filters: $filters) {
        total: totalNum
        questions: data { questionFrontendId titleSlug title difficulty isPaidOnly acRate topicTags { slug } }
      }
    }`,
    { limit: Math.min(opts.limit ?? 10, 25), filters },
  );
  return {
    total: data.list.total,
    problems: data.list.questions.map((q) => ({
      id: q.questionFrontendId,
      slug: q.titleSlug,
      title: q.title,
      difficulty: q.difficulty,
      paidOnly: q.isPaidOnly,
      acRate: Math.round(q.acRate),
      tags: q.topicTags.map((t) => t.slug),
    })),
  };
}

export async function getQuestion(slug: string): Promise<LcQuestion | null> {
  const data = await gql<{
    question: null | {
      questionFrontendId: string;
      titleSlug: string;
      title: string;
      difficulty: LcQuestion["difficulty"];
      isPaidOnly: boolean;
      topicTags: { name: string; slug: string }[];
      content: string | null;
      exampleTestcaseList: string[];
      metaData: string;
      codeSnippets: { langSlug: string; code: string }[] | null;
      hints: string[];
    };
  }>(
    `query q($slug: String!) {
      question(titleSlug: $slug) {
        questionFrontendId titleSlug title difficulty isPaidOnly
        topicTags { name slug } content exampleTestcaseList metaData
        codeSnippets { langSlug code } hints
      }
    }`,
    { slug },
  );
  const q = data.question;
  if (!q) return null;

  let metaData: LcMetaData | null = null;
  try {
    metaData = JSON.parse(q.metaData) as LcMetaData;
  } catch {
    metaData = null;
  }
  const snippets: LcQuestion["snippets"] = {};
  for (const s of q.codeSnippets ?? []) {
    if (s.langSlug === "javascript" || s.langSlug === "python3") snippets[s.langSlug] = s.code;
  }
  return {
    id: q.questionFrontendId,
    slug: q.titleSlug,
    title: q.title,
    difficulty: q.difficulty,
    paidOnly: q.isPaidOnly,
    tags: q.topicTags,
    contentHtml: q.content,
    exampleInputs: q.exampleTestcaseList ?? [],
    metaData,
    snippets,
    hints: q.hints ?? [],
  };
}

export async function getDaily(): Promise<{ date: string; slug: string; title: string; difficulty: string }> {
  const data = await gql<{
    activeDailyCodingChallengeQuestion: { date: string; question: { titleSlug: string; title: string; difficulty: string } };
  }>(`query { activeDailyCodingChallengeQuestion { date question { titleSlug title difficulty } } }`);
  const d = data.activeDailyCodingChallengeQuestion;
  return { date: d.date, slug: d.question.titleSlug, title: d.question.title, difficulty: d.question.difficulty };
}

/** Public: a user's most recent accepted submissions (no auth needed). */
export async function getRecentAccepted(username: string, limit = 15) {
  const data = await gql<{ recentAcSubmissionList: { title: string; titleSlug: string; timestamp: string; lang: string }[] }>(
    `query r($username: String!, $limit: Int) { recentAcSubmissionList(username: $username, limit: $limit) { title titleSlug timestamp lang } }`,
    { username, limit },
  );
  return data.recentAcSubmissionList.map((s) => ({ ...s, at: new Date(Number(s.timestamp) * 1000) }));
}
