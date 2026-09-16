import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { neon } from "@neondatabase/serverless";

// Run before `drizzle-kit push` so the `vector` type exists.
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("pgvector extension enabled");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
