/**
 * Small in-memory token bucket used to protect hot read endpoints.
 *
 * Vercel runs several short-lived instances, so this is a per-instance guard,
 * not a global quota: it stops a single client from hammering an endpoint in a
 * loop (the failure mode we care about), while a distributed limit would need
 * an external store. Callers should treat a rejection as "slow down", never as
 * an authorization decision.
 */

export type RateLimitDecision = {
  allowed: boolean;
  /** Seconds to wait before retrying (0 when allowed). */
  retryAfterSeconds: number;
};

export type TokenBucketOptions = {
  /** Maximum burst size. */
  capacity: number;
  /** Tokens restored per second. */
  refillPerSecond: number;
  /** Soft cap on tracked keys; idle and oldest entries are evicted first. */
  maxKeys?: number;
};

type Bucket = {
  tokens: number;
  updatedAt: number;
};

const IDLE_EVICTION_MS = 5 * 60_000;

export function createTokenBucketLimiter({
  capacity,
  refillPerSecond,
  maxKeys = 10_000,
}: TokenBucketOptions): (key: string, now?: number) => RateLimitDecision {
  if (capacity < 1 || refillPerSecond <= 0) {
    throw new Error("Token bucket needs a positive capacity and refill rate.");
  }
  const buckets = new Map<string, Bucket>();

  function prune(now: number) {
    if (buckets.size <= maxKeys) return;
    for (const [key, bucket] of buckets) {
      if (now - bucket.updatedAt > IDLE_EVICTION_MS) buckets.delete(key);
    }
    let overflow = buckets.size - maxKeys;
    if (overflow <= 0) return;
    // Map iteration is insertion order, so this drops the oldest keys first.
    for (const key of buckets.keys()) {
      if (overflow-- <= 0) break;
      buckets.delete(key);
    }
  }

  return function take(key: string, now = Date.now()): RateLimitDecision {
    const bucket = buckets.get(key);
    if (!bucket) {
      buckets.set(key, { tokens: capacity - 1, updatedAt: now });
      prune(now);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1_000;
    const tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
    bucket.updatedAt = now;

    if (tokens >= 1) {
      bucket.tokens = tokens - 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }

    bucket.tokens = tokens;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((1 - tokens) / refillPerSecond)),
    };
  };
}
