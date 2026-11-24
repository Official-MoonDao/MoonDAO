import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { discoverTownHalls, findStalledStreams } from "../find-missing";
import { json, mockFetch, quietConsole, video } from "./helpers";

let restoreConsole: () => void;
before(() => (restoreConsole = quietConsole()));
after(() => restoreConsole());

/**
 * The candidate list from the scheduled run of 2026-11-20 (run 44805387663):
 * ids, titles and publish times are copied from its log. That run tried to
 * summarize the ten "missing" ones and went red on four of them. Durations
 * and live-stream flags were not in the log; the values here are stand-ins
 * consistent with the transcript sizes it printed (about 55k characters for
 * the two streams, 1.4k–3.6k for everything else).
 */
type Fixture = [id: string, publishedAt: string, title: string, duration: string, live: boolean];

const NOV_20_CANDIDATES: Fixture[] = [
  ["SfrYEuWQPAU", "2026-11-20T09:20:01Z", "MoonDAO Town Hall | Network & Ecosystem Updates", "PT1H1M12S", true],
  ["VhjSJzPq6tg", "2026-11-19T22:00:19Z", "What it actually felt like to ride a rocket to space | MoonDAO", "PT2M34S", false],
  ["V2W9E_NUZk4", "2026-11-19T19:00:12Z", "What made Alan Stern spend decades fighting for Pluto | MoonDAO", "PT2M45S", false],
  ["4GFdD6IIlSc", "2026-11-19T16:00:34Z", "Alan Stern dove to the Titanic on the sub that later sank | MoonDAO", "PT3M58S", false],
  ["XN8KbxjKAew", "2026-11-14T22:00:11Z", "Getting to space was the easy part | MoonDAO", "PT1M40S", false],
  ["gde9ad-eZxs", "2026-11-14T19:00:25Z", "The commercial space boom is over. What replaces it? | MoonDAO", "PT1M34S", false],
  ["EYwRzDtvvis", "2026-11-14T16:00:10Z", "Came to America fleeing bombs. Made it to space anyway. | MoonDAO", "PT2M46S", false],
  ["DczVqy4fAYQ", "2026-11-13T09:32:54Z", "MOON BASE ZERO | 3D Simulation of the Entire Tech Tree for a Future Lunar Base", "PT1H4M3S", true],
  ["qfnojH_DphU", "2026-11-12T22:00:24Z", "She signed a space contract on the hood of a car | MoonDAO Town Hall", "PT1M38S", false],
  ["TydjgtuKcV8", "2026-11-12T19:00:25Z", "Why Sharon Hagle won't call herself a space tourist | MoonDAO Town Hall", "PT1M23S", false],
  ["HTDXn6xviIw", "2026-11-12T16:00:07Z", "The GoPro caught the first marital argument in space history | MoonDAO Town Hall", "PT2M", false],
  ["aYz_eMN7IZ0", "2026-11-11T22:00:35Z", "42 builders are flying to Brazil to hack the moon | MoonDAO Town Hall", "PT3M28S", false],
  ["fJe5Xy5-0uA", "2026-11-11T19:00:11Z", "A MoonDAO project brought rocketry to 700 kids across Colombia | MoonDAO Town Hall", "PT2M47S", false],
  ["bEVj_a3y9Eg", "2026-11-10T22:00:01Z", "What astronaut water survival training actually feels like | MoonDAO Town Hall", "PT3M3S", false],
  ["9pm41YNBN-I", "2026-11-10T19:00:22Z", "She showed friends Earth from the ISS window. They went silent. | MoonDAO Town Hall", "PT2M56S", false],
  ["5hOTTLjIzGE", "2026-11-09T22:00:14Z", "She never thought NASA would pick her. Then an astronaut called. | MoonDAO Town Hall", "PT2M25S", false],
  ["GeqT84SxAFE", "2026-11-09T19:00:07Z", "Water froze on her gloves. She still had to close the hatch. | MoonDAO Town Hall", "PT1M59S", false],
  ["82LrmOv_RkA", "2026-11-08T22:00:35Z", "The SpaceKind student who made it to orbit | MoonDAO Town Hall", "PT1M34S", false],
  ["P-_zALcWKcI", "2026-11-08T19:00:20Z", "Why seeing Earth from space stops people cold | MoonDAO Town Hall", "PT2M36S", false],
  ["mMFHegkm-Rg", "2026-11-06T22:00:32Z", "Spend a weekend at Space Camp with Frank White | MoonDAO Town Hall", "PT3M17S", false],
  ["h1TiCZY23Xk", "2026-11-06T21:06:02Z", "Big updates on the Overview Flight and our effort to send Frank White fwhite161 to space alongside a", "PT58S", false],
];

function youtubeApi(fixtures: Fixture[]) {
  return mockFetch((url) => {
    if (url.pathname.endsWith("/search")) {
      const liveOnly = url.searchParams.get("eventType") === "completed";
      const items = fixtures
        .filter(([, , , , live]) => (liveOnly ? live : true))
        .map(([id]) => ({ id: { videoId: id } }));
      return json({ items });
    }

    if (url.pathname.endsWith("/videos")) {
      const ids = (url.searchParams.get("id") || "").split(",");
      const items = fixtures
        .filter(([id]) => ids.includes(id))
        .map(([id, publishedAt, title, duration, live]) => ({
          id,
          snippet: {
            title,
            publishedAt,
            channelId: "UC_moondao",
            liveBroadcastContent: "none",
          },
          contentDetails: { duration },
          ...(live
            ? {
                liveStreamingDetails: {
                  actualStartTime: publishedAt,
                  actualEndTime: publishedAt,
                },
              }
            : {}),
        }));
      return json({ items });
    }

    throw new Error(`unexpected request: ${url}`);
  });
}

async function discover() {
  return discoverTownHalls({
    channelId: "UC_moondao",
    youtubeApiKey: "key",
    publishedAfterIso: "2026-11-06T00:00:00Z",
    maxPerQuery: 50,
  });
}

test("the Nov 20 candidate list contains exactly two town halls", async () => {
  const api = youtubeApi(NOV_20_CANDIDATES);
  try {
    const discovery = await discover();

    assert.deepEqual(
      discovery.townHalls.map((v) => v.id),
      ["DczVqy4fAYQ", "SfrYEuWQPAU"],
      "oldest first"
    );
    assert.equal(discovery.notTownHalls.length, 19);
    assert.equal(discovery.inProgress.length, 0);

    // The four videos that turned that run red are all ignored now.
    const ignored = new Set(discovery.notTownHalls.map((s) => s.video.id));
    for (const id of ["h1TiCZY23Xk", "P-_zALcWKcI", "9pm41YNBN-I", "XN8KbxjKAew"]) {
      assert.ok(ignored.has(id), `${id} should be ignored`);
    }
  } finally {
    api.restore();
  }
});

test("all candidates are looked up in one videos.list call", async () => {
  const api = youtubeApi(NOV_20_CANDIDATES);
  try {
    await discover();
    const videoCalls = api.calls.filter((u) => u.pathname.endsWith("/videos"));
    assert.equal(videoCalls.length, 1);
    assert.match(
      videoCalls[0].searchParams.get("part") || "",
      /liveStreamingDetails/
    );
  } finally {
    api.restore();
  }
});

test("next week's scheduled stream is not mistaken for a missing summary", async () => {
  const api = mockFetch((url) => {
    if (url.pathname.endsWith("/search")) {
      return json({ items: [{ id: { videoId: "upcoming001" } }] });
    }
    return json({
      items: [
        {
          id: "upcoming001",
          snippet: {
            title: "MoonDAO Town Hall | Network & Ecosystem Updates",
            publishedAt: "2026-11-20T10:00:00Z",
            liveBroadcastContent: "upcoming",
          },
          contentDetails: { duration: "P0D" },
        },
      ],
    });
  });
  try {
    const discovery = await discover();
    assert.equal(discovery.townHalls.length, 0);
    assert.equal(discovery.notTownHalls.length, 0);
    assert.deepEqual(
      discovery.inProgress.map((s) => s.video.id),
      ["upcoming001"]
    );
  } finally {
    api.restore();
  }
});

test("a finished stream with no length is reported once the grace period has passed", () => {
  const ended = "2026-11-19T21:00:00Z";
  const stream = (id: string, overrides = {}) => ({
    video: video({ id, durationSeconds: 0, actualEndTime: ended, ...overrides }),
    reason: "YouTube is still processing the stream recording",
  });
  const inProgress = [
    stream("stalled0001"),
    stream("summarized1"),
    stream("upcoming001", { liveBroadcastContent: "upcoming" }),
  ];
  const summarized = new Set(["summarized1"]);
  const at = (hours: number) =>
    new Date(new Date(ended).getTime() + hours * 3_600_000);

  assert.deepEqual(findStalledStreams(inProgress, summarized, 36, at(20)), []);

  const stalled = findStalledStreams(inProgress, summarized, 36, at(40));
  assert.deepEqual(
    stalled.map((r) => [r.videoId, r.status, r.hoursSinceEnded]),
    [["stalled0001", "failed", 40]]
  );
  assert.match(stalled[0].error || "", /yarn retro stalled0001/);
});

test("a YouTube API error stops the run instead of reporting nothing to do", async () => {
  const api = mockFetch(() => json({ error: { message: "quotaExceeded" } }, 403));
  try {
    await assert.rejects(discover(), /YouTube API error 403/);
  } finally {
    api.restore();
  }
});
