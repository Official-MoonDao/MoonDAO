import { test } from "node:test";
import assert from "node:assert/strict";
import { findClipBroadcasts } from "../prune-clips";
import { ConvertKitBroadcast } from "../utils/convertkit";
import { video } from "./helpers";

const broadcast = (id: string, videoId: string): ConvertKitBroadcast => ({
  id,
  subject: "Town Hall Summary",
  content: `<!-- TOWNHALL_VIDEO_ID:${videoId} -->`,
  created_at: "2026-11-20T12:00:00Z",
  public: true,
});

test("only broadcasts for videos known to be short are selected", () => {
  const broadcasts = [
    broadcast("27190158", "SfrYEuWQPAU"),
    broadcast("27190155", "VhjSJzPq6tg"),
    broadcast("25972425", "longupload1"),
    broadcast("25972440", "AnBWVTsWvps"),
    { ...broadcast("1", "x"), content: "<h1>Town Hall Summary - May 1, 2025</h1>" },
  ];

  const videos = new Map([
    ["SfrYEuWQPAU", video({ id: "SfrYEuWQPAU", durationSeconds: 3672 })],
    ["VhjSJzPq6tg", video({ id: "VhjSJzPq6tg", durationSeconds: 154 })],
    // Long but not a live stream: the scheduled job would ignore it, yet it
    // is not a clip, so an existing summary of it stays.
    [
      "longupload1",
      video({
        id: "longupload1",
        title: "A two hour upload",
        durationSeconds: 7200,
        actualStartTime: undefined,
        actualEndTime: undefined,
      }),
    ],
    // AnBWVTsWvps is missing: deleted or private on YouTube. Keep its summary.
  ]);

  const clips = findClipBroadcasts(broadcasts, videos, 20);

  assert.deepEqual(
    clips.map((c) => c.broadcast.id),
    ["27190155"]
  );
});

test("a video with no reported duration is kept", () => {
  const clips = findClipBroadcasts(
    [broadcast("1", "SfrYEuWQPAU")],
    new Map([["SfrYEuWQPAU", video({ id: "SfrYEuWQPAU", durationSeconds: 0 })]]),
    20
  );
  assert.equal(clips.length, 0);
});
