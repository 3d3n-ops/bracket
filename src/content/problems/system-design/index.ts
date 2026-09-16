import type { ProblemSeed } from "../types";

const sd = (
  p: Omit<ProblemSeed, "kind" | "starterCode" | "tests" | "category"> & { category?: string },
): ProblemSeed => ({
  kind: "system_design",
  category: p.category ?? "System Design",
  starterCode: {},
  tests: [],
  ...p,
});

export const systemDesign: ProblemSeed[] = [
  sd({
    slug: "url-shortener",
    title: "Design a URL Shortener",
    difficulty: "easy",
    tags: ["hashing", "key-generation", "caching", "read-heavy"],
    promptMd: `Design a service like bit.ly.

**Functional requirements**
- Given a long URL, return a short unique alias.
- Redirect a short alias to the original URL.
- Optional: custom aliases, expiry, click analytics.

**Non-functional**
- 100M new URLs / month, ~10:1 read:write ratio... work out the numbers.
- Redirects must be fast (< 50 ms p99).
- Aliases must not be guessable in bulk.

Use the whiteboard. Start with requirements & estimates, then API, data model, high-level architecture, then deep-dive into key generation and scaling reads.`,
    hints: [
      "How do you generate a unique 7-character key? Compare hashing + collision checks vs. a pre-generated key service vs. base62(counter).",
      "Reads dominate. Where does a cache go, and what is your eviction policy?",
      "How does a 301 vs 302 redirect affect your analytics?",
    ],
    solutionMd: `Key points an interviewer expects: capacity estimation (~40 writes/s, ~400 reads/s, ~15 TB over 5 years at 500 B/row), a base62 key of length 7 (3.5T combos), a Key Generation Service that pre-allocates unique keys to avoid collision checks, a KV store or sharded SQL for url→long mapping, a cache (Redis/Memcached, LRU) in front for hot links, 302 redirects so clicks hit the service for analytics, and a cleanup job for expired links.`,
  }),
  sd({
    slug: "rate-limiter",
    title: "Design a Rate Limiter",
    difficulty: "medium",
    tags: ["distributed", "algorithms", "redis"],
    promptMd: `Design a distributed rate limiter that caps each client at N requests per time window across a fleet of API servers.

**Requirements**
- Accurate limits (e.g. 100 req/min per API key).
- Low latency (adds < 1 ms), high availability.
- Should work across many servers (not per-instance).

Cover: where it sits (middleware vs. gateway), algorithm choice, the storage and its failure modes, and what the client sees when limited.`,
    hints: [
      "Compare token bucket, leaky bucket, fixed window, sliding window log, sliding window counter. What are the memory and accuracy trade-offs?",
      "A centralized Redis with atomic Lua scripts vs. per-node limits with gossip. What happens when Redis is down — fail open or closed?",
      "What headers do you return? (X-RateLimit-Remaining, Retry-After, 429)",
    ],
  }),
  sd({
    slug: "news-feed",
    title: "Design a News Feed",
    difficulty: "medium",
    tags: ["fan-out", "caching", "ranking", "read-heavy"],
    promptMd: `Design the news feed for a social network (like Facebook/Twitter): users post, follow others, and see a ranked feed of posts from people they follow.

**Scale**: 300M DAU, average 200 follows, 10M posts/day, feed loads ~ 10× posts.

Cover: post publishing path, feed generation (fan-out on write vs. read), the celebrity problem, feed cache, ranking, and media handling.`,
    hints: [
      "Fan-out on write pre-computes feeds — fast reads, but what about a user with 50M followers?",
      "Hybrid: fan-out on write for normal users, fan-out on read for celebrities, merged at read time.",
      "What's stored in the feed cache — full posts or just post IDs? Why?",
    ],
  }),
  sd({
    slug: "chat-system",
    title: "Design a Chat System",
    difficulty: "medium",
    tags: ["websockets", "messaging", "presence", "consistency"],
    promptMd: `Design a 1:1 and small-group chat system like WhatsApp/Slack.

**Requirements**
- Real-time delivery, message ordering within a conversation.
- Online/offline presence, delivery & read receipts.
- Message history, multi-device sync.
- 50M DAU.

Cover: connection handling (WebSocket vs long-poll), how a message flows from sender to recipient, message storage & IDs, presence, and push notifications for offline users.`,
    hints: [
      "Stateful chat servers hold WebSocket connections — how does server A know that user B is connected to server C?",
      "Message IDs must be sortable within a conversation. Global auto-increment doesn't scale; look at Snowflake-style IDs.",
      "Presence via heartbeats; what's the trade-off between heartbeat interval and presence accuracy/load?",
    ],
  }),
  sd({
    slug: "key-value-store",
    title: "Design a Distributed Key-Value Store",
    difficulty: "hard",
    tags: ["distributed", "consistency", "replication", "partitioning"],
    promptMd: `Design a highly available, horizontally scalable key-value store (think Dynamo/Cassandra).

**Requirements**
- \`put(key, value)\`, \`get(key)\`; values up to 10 KB.
- Tunable consistency; survive node failures; scale to petabytes.

Cover: partitioning (consistent hashing, virtual nodes), replication, quorum reads/writes (N, W, R), conflict resolution (vector clocks vs. LWW), failure detection (gossip), hinted handoff, anti-entropy (Merkle trees), and the write path (commit log, memtable, SSTables).`,
    hints: [
      "Consistent hashing with virtual nodes — why virtual nodes?",
      "With N=3, what W and R give strong consistency? Which give fast reads?",
      "How do you detect and repair divergent replicas after a network partition?",
    ],
  }),
  sd({
    slug: "notification-system",
    title: "Design a Notification System",
    difficulty: "medium",
    tags: ["queues", "fan-out", "third-party", "reliability"],
    promptMd: `Design a system that sends push, SMS, and email notifications at scale (10M push, 1M SMS, 5M email per day).

Cover: how notifications enter the system (API + event triggers), user preferences and opt-outs, queueing per channel, worker pools and third-party provider integration, retries, deduplication, rate limiting, templates, and analytics.`,
    hints: [
      "Why a message queue per channel? What happens if the SMS provider is down for 30 minutes?",
      "Exactly-once is hard; how do you make delivery idempotent so retries don't double-send?",
    ],
  }),
  sd({
    slug: "web-crawler",
    title: "Design a Web Crawler",
    difficulty: "hard",
    tags: ["distributed", "bfs", "politeness", "dedup"],
    promptMd: `Design a crawler that fetches ~1 billion pages per month for a search index.

Cover: seed URLs and the URL frontier (prioritization + politeness), DNS resolution, fetching, content parsing & dedup (content hashing / SimHash), URL extraction + normalization + dedup (Bloom filter), storage, robots.txt, traps (infinite calendars), and how to distribute it.`,
    hints: [
      "Politeness: one host shouldn't be hammered — how does the frontier enforce per-host delay?",
      "How do you avoid re-crawling the same content at a different URL?",
    ],
  }),
  sd({
    slug: "ticket-booking",
    title: "Design a Ticket Booking System",
    difficulty: "medium",
    tags: ["transactions", "concurrency", "locking", "consistency"],
    promptMd: `Design a system to sell seats for events (like Ticketmaster) where thousands of users compete for the same seats at on-sale time.

Cover: event/seat data model, seat hold with expiry, preventing double booking (optimistic vs. pessimistic locking, DB constraints), payment flow and its failure modes, virtual waiting room for hot events, and caching seat maps.`,
    hints: [
      "Two users click the same seat at the same millisecond. Walk through exactly what happens in your design.",
      "How long is a seat held during checkout, and where is the hold stored so it expires reliably?",
    ],
  }),
];
