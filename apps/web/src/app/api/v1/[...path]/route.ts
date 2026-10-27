import { NextResponse, type NextRequest } from "next/server";
import { dispatch, ensureUser } from "@repo/api-server";
import { getDb } from "@/server/db";
import { getIdentity, getUserId } from "@/server/identity";
import { getPlaid } from "@/server/plaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Users already provisioned by this server process, to skip repeat upserts. */
const provisioned = new Set<string>();

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ message: "DATABASE_URL is not set. Use NEXT_PUBLIC_API_MODE=mock or configure Postgres." }, { status: 503 });
  }
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ message: "Sign in required" }, { status: 401 });
  if (!provisioned.has(userId)) {
    await ensureUser(db, await getIdentity(userId));
    provisioned.add(userId);
  }

  let body: unknown;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const text = await req.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ message: "Body must be JSON" }, { status: 400 });
      }
    }
  }

  const { path } = await params;
  const res = await dispatch(
    { method: req.method, path: `/${path.map(encodeURIComponent).join("/")}`, searchParams: req.nextUrl.searchParams, headers: req.headers, body },
    { db, userId, plaid: getPlaid() },
  );
  return NextResponse.json(res.body, { status: res.status, headers: { "cache-control": "no-store" } });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
