import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findBroadcastByVideoId,
  getTownHallBroadcasts,
  indexBroadcastsByVideoId,
} from "../utils/convertkit";
import { json, mockFetch } from "./helpers";

const summary = (id: string, videoId: string) => ({
  id,
  subject: "Town Hall Summary",
  content: `\n<!-- TOWNHALL_VIDEO_ID:${videoId} -->\n<h1>Town Hall Summary</h1>`,
  created_at: "2026-11-20T12:00:00Z",
  public: true,
});

const newsletter = (id: string) => ({
  id,
  subject: "Monthly newsletter",
  content: "<p>Hello</p>",
  created_at: "2026-11-01T12:00:00Z",
  public: true,
});

const fast = { retryDelayMs: 0 };

test("a ConvertKit outage throws instead of looking like an empty account", async () => {
  const api = mockFetch(() => json({}, 503));
  try {
    await assert.rejects(
      getTownHallBroadcasts("key", fast),
      /Could not list ConvertKit broadcasts: ConvertKit API error: 503/
    );
    assert.equal(api.calls.length, 3);
  } finally {
    api.restore();
  }
});

test("a rate limit is retried", async () => {
  let attempt = 0;
  const api = mockFetch(() =>
    ++attempt === 1
      ? json({}, 429)
      : json({ broadcasts: [summary("1", "SfrYEuWQPAU"), newsletter("2")] })
  );
  try {
    const broadcasts = await getTownHallBroadcasts("key", fast);
    assert.deepEqual(
      broadcasts.map((b) => b.id),
      ["1"]
    );
  } finally {
    api.restore();
  }
});

test("a rejected API key is not retried", async () => {
  const api = mockFetch(() => json({}, 401));
  try {
    await assert.rejects(getTownHallBroadcasts("key", fast), /401/);
    assert.equal(api.calls.length, 1);
  } finally {
    api.restore();
  }
});

test("every page of broadcasts is read", async () => {
  const api = mockFetch((url) =>
    url.searchParams.get("after") === "cursor-1"
      ? json({
          broadcasts: [summary("2", "DczVqy4fAYQ")],
          pagination: { has_next_page: false, end_cursor: "cursor-2" },
        })
      : json({
          broadcasts: [summary("1", "SfrYEuWQPAU")],
          pagination: { has_next_page: true, end_cursor: "cursor-1" },
        })
  );
  try {
    const byVideo = indexBroadcastsByVideoId(
      await getTownHallBroadcasts("key", fast)
    );
    assert.deepEqual([...byVideo.keys()], ["SfrYEuWQPAU", "DczVqy4fAYQ"]);
    assert.equal(api.calls.length, 2);
  } finally {
    api.restore();
  }
});

test("a cursor that does not advance cannot loop forever", async () => {
  const api = mockFetch(() =>
    json({
      broadcasts: [summary("1", "SfrYEuWQPAU")],
      pagination: { has_next_page: true, end_cursor: "stuck" },
    })
  );
  try {
    await getTownHallBroadcasts("key", fast);
    assert.equal(api.calls.length, 2);
  } finally {
    api.restore();
  }
});

test("findBroadcastByVideoId propagates the outage", async () => {
  const api = mockFetch(() => {
    throw new Error("socket hang up");
  });
  const originalSetTimeout = globalThis.setTimeout;
  // Skip the real backoff; this path has no injectable delay.
  globalThis.setTimeout = ((fn: () => void) =>
    originalSetTimeout(fn, 0)) as typeof setTimeout;
  try {
    await assert.rejects(
      findBroadcastByVideoId("SfrYEuWQPAU", "key"),
      /socket hang up/
    );
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    api.restore();
  }
});
