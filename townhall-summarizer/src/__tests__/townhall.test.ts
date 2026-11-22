import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyVideo,
  getSkipVideoIds,
  hoursSinceEnded,
} from "../utils/townhall";
import { parseIsoDurationSeconds } from "../utils/youtube";
import { video } from "./helpers";

test("parseIsoDurationSeconds handles the shapes the Data API returns", () => {
  assert.equal(parseIsoDurationSeconds("PT58S"), 58);
  assert.equal(parseIsoDurationSeconds("PT2M41S"), 161);
  assert.equal(parseIsoDurationSeconds("PT1H2M3S"), 3723);
  assert.equal(parseIsoDurationSeconds("PT1H"), 3600);
  assert.equal(parseIsoDurationSeconds("P1DT2H"), 93600);
  assert.equal(parseIsoDurationSeconds("P0D"), 0);
  assert.equal(parseIsoDurationSeconds(""), null);
  assert.equal(parseIsoDurationSeconds(undefined), null);
  assert.equal(parseIsoDurationSeconds("garbage"), null);
});

test("an hour-long completed live stream is a town hall", () => {
  assert.deepEqual(classifyVideo(video({ id: "SfrYEuWQPAU" })), {
    kind: "townhall",
  });
});

test("a renamed stream is still a town hall", () => {
  // DczVqy4fAYQ aired as "MoonDAO Town Hall | Network & Ecosystem Updates"
  // and was retitled a week later.
  const renamed = video({
    id: "DczVqy4fAYQ",
    title:
      "MOON BASE ZERO | 3D Simulation of the Entire Tech Tree for a Future Lunar Base",
  });
  assert.equal(classifyVideo(renamed).kind, "townhall");
});

test("a short clip is not a town hall even when its title says so", () => {
  const clip = video({
    id: "P-_zALcWKcI",
    title: "Why seeing Earth from space stops people cold | MoonDAO Town Hall",
    durationSeconds: 161,
    actualStartTime: undefined,
    actualEndTime: undefined,
  });
  const result = classifyVideo(clip);
  assert.equal(result.kind, "not-townhall");
  assert.match((result as { reason: string }).reason, /2m 41s long/);
});

test("a short live stream is not a town hall either", () => {
  const result = classifyVideo(video({ id: "aaaaaaaaaaa", durationSeconds: 300 }));
  assert.equal(result.kind, "not-townhall");
});

test("a long upload counts only when it is titled Town Hall", () => {
  const upload = {
    durationSeconds: 3600,
    actualStartTime: undefined,
    actualEndTime: undefined,
  };
  assert.equal(
    classifyVideo(
      video({ id: "aaaaaaaaaaa", title: "Jeanette Epps | MoonDAO Town Hall", ...upload })
    ).kind,
    "townhall"
  );
  assert.equal(
    classifyVideo(
      video({ id: "bbbbbbbbbbb", title: "Lunar documentary", ...upload })
    ).kind,
    "not-townhall"
  );
});

test("the completed-live-streams search vouches for a video without live details", () => {
  const noDetails = video({
    id: "aaaaaaaaaaa",
    title: "Lunar documentary",
    actualStartTime: undefined,
    actualEndTime: undefined,
  });
  assert.equal(
    classifyVideo(noDetails, { knownLiveStream: true }).kind,
    "townhall"
  );
});

test("upcoming and live streams are left for a later run", () => {
  for (const state of ["upcoming", "live"]) {
    const result = classifyVideo(
      video({ id: "aaaaaaaaaaa", liveBroadcastContent: state, durationSeconds: 0 })
    );
    assert.equal(result.kind, "in-progress");
  }
});

test("a finished stream with no duration yet is in progress, not rejected", () => {
  const processing = video({ id: "aaaaaaaaaaa", durationSeconds: 0 });
  assert.equal(classifyVideo(processing).kind, "in-progress");
});

test("the skip list overrides everything", () => {
  const result = classifyVideo(video({ id: "SfrYEuWQPAU" }), {
    skipVideoIds: new Set(["SfrYEuWQPAU"]),
  });
  assert.equal(result.kind, "not-townhall");
});

test("the minimum duration is configurable", () => {
  const halfHour = video({ id: "aaaaaaaaaaa", durationSeconds: 1800 });
  assert.equal(classifyVideo(halfHour).kind, "townhall");
  assert.equal(
    classifyVideo(halfHour, { minDurationMinutes: 45 }).kind,
    "not-townhall"
  );
});

test("TOWNHALL_SKIP_VIDEO_IDS accepts spaces and commas", () => {
  process.env.TOWNHALL_SKIP_VIDEO_IDS = "aaaaaaaaaaa, bbbbbbbbbbb ccccccccccc";
  try {
    assert.deepEqual(
      [...getSkipVideoIds()],
      ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]
    );
  } finally {
    delete process.env.TOWNHALL_SKIP_VIDEO_IDS;
  }
});

test("age is measured from when the stream ended, not from publishedAt", () => {
  // The API reported publishedAt 2026-10-14T12:25:45Z for m5nA2Bv6qa4 on
  // Oct 16 and 2026-10-15T21:41:07Z a week later, so it cannot anchor the
  // grace period. The stream times here are made up for the test.
  const stream = video({
    id: "m5nA2Bv6qa4",
    publishedAt: "2026-10-14T12:25:45Z",
    actualStartTime: "2026-10-15T21:41:07Z",
    actualEndTime: "2026-10-15T22:41:07Z",
  });
  const hours = hoursSinceEnded(stream, new Date("2026-10-16T16:41:07Z"));
  assert.equal(hours, 18);
});
