import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ProcessDeps, processVideos } from "../retro";
import { TranscriptNotReadyError } from "../utils/processing";
import { ConvertKitBroadcast } from "../utils/convertkit";
import { formatAlert, runFailed } from "../utils/report";
import { quietConsole, video } from "./helpers";

let restoreConsole: () => void;
before(() => (restoreConsole = quietConsole()));
after(() => restoreConsole());

const VIDEO_ID = "SfrYEuWQPAU";
const ENDED_AT = "2026-11-19T21:00:00Z";
const hoursAfterEnd = (hours: number) =>
  new Date(new Date(ENDED_AT).getTime() + hours * 3_600_000);

const broadcast = (id: string): ConvertKitBroadcast => ({
  id,
  subject: "Town Hall Summary",
  content: "",
  created_at: "2026-11-20T12:00:00Z",
  public: true,
});

function setup(overrides: Partial<ProcessDeps> = {}) {
  const created: string[] = [];
  const deps: ProcessDeps = {
    findBroadcastByVideoId: async () => null,
    getVideoMetadata: async (id) =>
      video({ id, actualEndTime: ENDED_AT, title: "Astronaut Ron Garan | MoonDAO Town Hall" }),
    getTranscript: async () => "transcript",
    summarizeTranscript: async () => "## Project Updates\n- shipped",
    createConvertKitBroadcast: async (_subject, content) => {
      created.push(content);
      return broadcast("27190158");
    },
    ...overrides,
  };
  return { deps, created };
}

const keys = { youtubeApiKey: "yt", convertKitApiKey: "ck" };
const notReady = async (): Promise<string> => {
  throw new TranscriptNotReadyError(
    "Video SfrYEuWQPAU has no usable caption track, and YouTube blocked the audio download from this machine."
  );
};

test("a town hall with captions gets a broadcast", async () => {
  const { deps, created } = setup();
  const results = await processVideos([VIDEO_ID], { ...keys, deps });

  assert.equal(results[0].status, "created");
  assert.equal(results[0].broadcastId, "27190158");
  assert.equal(created.length, 1);
  assert.match(created[0], /<!-- TOWNHALL_VIDEO_ID:SfrYEuWQPAU -->/);
  assert.equal(runFailed(results), false);
});

test("an already summarized video is not a failure and is not re-published", async () => {
  const { deps, created } = setup({
    findBroadcastByVideoId: async () => broadcast("111"),
  });
  const results = await processVideos([VIDEO_ID], { ...keys, deps });

  assert.equal(results[0].status, "already-processed");
  assert.equal(created.length, 0);
  assert.equal(runFailed(results), false);
});

test("scheduled run: captions not ready the day after the stream is pending, not failed", async () => {
  const { deps } = setup({ getTranscript: notReady });
  const results = await processVideos([VIDEO_ID], {
    ...keys,
    deps,
    captionGraceHours: 36,
    now: hoursAfterEnd(18),
  });

  assert.equal(results[0].status, "pending");
  assert.equal(runFailed(results), false);
  assert.equal(formatAlert(results), null);
});

test("scheduled run: captions still missing after the grace period fails and says what to do", async () => {
  const { deps } = setup({ getTranscript: notReady });
  const results = await processVideos([VIDEO_ID], {
    ...keys,
    deps,
    captionGraceHours: 36,
    now: hoursAfterEnd(42),
  });

  assert.equal(results[0].status, "failed");
  assert.equal(runFailed(results), true);

  const alert = formatAlert(results);
  assert.ok(alert);
  assert.match(alert, /1 town hall could not be summarized/);
  assert.match(alert, /"Astronaut Ron Garan \| MoonDAO Town Hall" <https:\/\/youtu\.be\/SfrYEuWQPAU>, ended 42h ago/);
  assert.match(alert, /no usable caption track/);
});

test("manual run: captions not ready fails straight away", async () => {
  const { deps } = setup({ getTranscript: notReady });
  const results = await processVideos([VIDEO_ID], {
    ...keys,
    deps,
    now: hoursAfterEnd(2),
  });
  assert.equal(results[0].status, "failed");
});

test("a real breakage inside the grace period still fails", async () => {
  const { deps } = setup({
    getTranscript: async () => {
      throw new Error("Refresh token rejected (invalid_grant)");
    },
  });
  const results = await processVideos([VIDEO_ID], {
    ...keys,
    deps,
    captionGraceHours: 36,
    now: hoursAfterEnd(2),
  });

  assert.equal(results[0].status, "failed");
  assert.match(results[0].error || "", /invalid_grant/);
});

test("when ConvertKit cannot be read nothing is published", async () => {
  const { deps, created } = setup({
    findBroadcastByVideoId: async () => {
      throw new Error("Could not list ConvertKit broadcasts: ConvertKit API error: 503");
    },
  });
  const results = await processVideos([VIDEO_ID], { ...keys, deps });

  assert.equal(results[0].status, "failed");
  assert.equal(created.length, 0);
});

test("one failure does not stop the videos after it", async () => {
  const { deps, created } = setup({
    getTranscript: async (id) => {
      if (id === "aaaaaaaaaaa") throw new Error("boom");
      return "transcript";
    },
  });
  const results = await processVideos(["aaaaaaaaaaa", VIDEO_ID], { ...keys, deps });

  assert.deepEqual(
    results.map((r) => r.status),
    ["failed", "created"]
  );
  assert.equal(created.length, 1);

  const alert = formatAlert(results);
  assert.ok(alert);
  assert.match(alert, /Published in the same run/);
});

test("an invalid id is reported without calling anything", async () => {
  const { deps } = setup({
    findBroadcastByVideoId: async () => {
      throw new Error("should not be called");
    },
  });
  const results = await processVideos(["not a video"], { ...keys, deps });
  assert.equal(results[0].status, "failed");
  assert.equal(results[0].error, "Invalid video URL or ID");
});
