import { getDaily } from "@/lib/leetcode/client";

export async function GET() {
  try {
    return Response.json(await getDaily());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
