import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTokenBucketLimiter } from "@/lib/rate-limit";
import { WORLD_ENTITY_MAX_OBJECTS } from "@/lib/world-realtime";
import {
  isWorldActionError,
  loadWorldEntities,
} from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * 180 requests/minute per user, with a 60 request burst.
 *
 * A healthy client polls 5 times/minute or sends at most one hint batch every
 * 400 ms (~150/minute during a sustained battle), so this only trips on a
 * runaway loop or a misbehaving script.
 */
const takeEntityBudget = createTokenBucketLimiter({ capacity: 60, refillPerSecond: 3 });

/**
 * Read-only endpoint used by the realtime client.
 *
 * `?ids=a,b,c` fetches specific map objects (hint follow-up).
 * `?all=1` fetches every map object currently in view (polling / resync).
 * Without either, only the visible base list is returned.
 *
 * Everything is scoped to the authenticated user's view radius and contains no
 * private data (resources, army, research, items stay in `/api/world`).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập để đồng bộ thế giới." }, { status: 401 });
  }

  const budget = takeEntityBudget(user.id);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "Đồng bộ thế giới quá nhanh. Hãy thử lại sau." },
      {
        status: 429,
        headers: {
          "Retry-After": String(budget.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const rawIds = url.searchParams.get("ids");
  const ids = rawIds
    ? [...new Set(rawIds.split(",").map((id) => id.trim()))]
        .filter((id) => ID_PATTERN.test(id))
        .slice(0, WORLD_ENTITY_MAX_OBJECTS)
    : [];

  try {
    const payload = await loadWorldEntities(user.id, ids, { all });
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isWorldActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
