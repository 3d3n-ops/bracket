import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ANON_COOKIE } from "./constants";

/**
 * Returns the current anonymous user's id, creating the `users` row if needed.
 * The cookie is set by `src/proxy.ts`; if it is somehow missing (e.g. a
 * direct API call from a script) we throw so callers fail loudly.
 */
export async function getCurrentUserId(): Promise<string> {
  const store = await cookies();
  const id = store.get(ANON_COOKIE)?.value;
  if (!id) throw new Error("No anonymous user cookie — proxy did not run");

  await db.insert(users).values({ id }).onConflictDoNothing();
  return id;
}
