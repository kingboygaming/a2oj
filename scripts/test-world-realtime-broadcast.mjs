/**
 * Tests for the server -> Supabase Broadcast bridge.
 *
 * A tiny local HTTP server stands in for Supabase's REST broadcast endpoint so
 * the real `world-realtime-server` code path (topic grouping, payload shape,
 * failure handling) runs without any Supabase credentials.
 *
 * Run with: npx tsx scripts/test-world-realtime-broadcast.mjs
 */

import assert from "node:assert";
import http from "node:http";

let passed = 0;
function check(name, fn) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`  ✓ ${name}`);
  });
}

function section(title) {
  console.log(`\n${title}`);
}

const received = [];
const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    received.push({ url: request.url, headers: request.headers, body: JSON.parse(body || "{}") });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end("{}");
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const {
  broadcastBaseChanges,
  broadcastMapObjectChange,
  broadcastWorldChanges,
  isWorldRealtimeBroadcastConfigured,
  queueWorldRealtimeChanges,
} = await import("../src/lib/world-realtime-server.js");
const { worldRealtimeTopic, worldRegionKey } = await import("../src/lib/world-realtime.js");
const { resolveWorldMapObject } = await import("../src/lib/world-generation.js");

function drain() {
  return received.splice(0, received.length);
}

section("[1] Configuration");
await check("configured when URL + service role are present", () => {
  assert.equal(isWorldRealtimeBroadcastConfigured(), true);
});

section("[2] Map object hints");
await check("publishes one message to the region that owns the object", async () => {
  drain();
  await broadcastMapObjectChange("forest-01");
  assert.equal(received.length, 1);
  const [message] = received[0].body.messages;
  const definition = resolveWorldMapObject("forest-01");
  assert.equal(message.topic, worldRealtimeTopic(worldRegionKey(definition.x, definition.z)));
  assert.equal(message.event, "world-change");
  assert.equal(message.private, false);
  assert.equal(message.payload.v, 1);
  assert.equal(typeof message.payload.eventId, "string");
  assert.deepEqual(message.payload.changes, [{ kind: "MAP_OBJECT", id: "forest-01" }]);
});

await check("authenticates with the service role key", async () => {
  const [request] = received;
  assert.equal(request.headers.apikey, "test-service-role-key");
  assert.equal(request.headers.authorization, "Bearer test-service-role-key");
  assert.equal(request.url, "/realtime/v1/api/broadcast");
});

await check("objects in different regions produce separate messages", async () => {
  drain();
  await broadcastWorldChanges([
    { kind: "MAP_OBJECT", id: "forest-01" },
    { kind: "MAP_OBJECT", id: "forest-02" },
    { kind: "MAP_OBJECT", id: "camp-elite" },
  ]);
  assert.equal(received.length, 3);
});

await check("unknown ids are ignored without a request", async () => {
  drain();
  await broadcastMapObjectChange("does-not-exist");
  assert.equal(received.length, 0);
});

await check("duplicate ids in one batch are published once", async () => {
  drain();
  await broadcastWorldChanges([
    { kind: "MAP_OBJECT", id: "forest-01" },
    { kind: "MAP_OBJECT", id: "forest-01" },
  ]);
  assert.equal(received.length, 1);
  assert.equal(received[0].body.messages[0].payload.changes.length, 1);
});

section("[3] queueWorldRealtimeChanges");
await check("falls back to an immediate publish outside a request scope", async () => {
  drain();
  queueWorldRealtimeChanges([{ kind: "MAP_OBJECT", id: "iron-01" }]);
  for (let attempt = 0; attempt < 50 && received.length === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(received.length, 1);
  assert.equal(received[0].body.messages[0].payload.changes[0].id, "iron-01");
});

await check("caps one queued batch at 50 unique hints", async () => {
  drain();
  const changes = Array.from({ length: 80 }, () => ({ kind: "MAP_OBJECT", id: "forest-01" }));
  queueWorldRealtimeChanges(changes);
  for (let attempt = 0; attempt < 50 && received.length === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(received.length, 1);
  assert(received[0].body.messages[0].payload.changes.length <= 50);
});

await check("empty changes never touch the network", async () => {
  drain();
  queueWorldRealtimeChanges([]);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(received.length, 0);
});

section("[4] Failure isolation");
await check("a broadcast failure never rejects", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  try {
    await broadcastMapObjectChange("forest-01");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("a non-2xx response never rejects", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("nope", { status: 500 });
  try {
    await broadcastMapObjectChange("forest-01");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("no-ops when the deployment has no Supabase keys", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}");
  };
  const url = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    await broadcastMapObjectChange("forest-01");
    await broadcastBaseChanges(["someone"]);
    queueWorldRealtimeChanges([{ kind: "MAP_OBJECT", id: "forest-01" }]);
    assert.equal(isWorldRealtimeBroadcastConfigured(), false);
    assert.equal(called, false);
  } finally {
    process.env.SUPABASE_URL = url;
    globalThis.fetch = originalFetch;
  }
});

server.close();
console.log(`\nALL TESTS PASSED (${passed} checks).`);
