import "dotenv/config";
import {
  getTownHallBroadcasts,
  indexBroadcastsByVideoId,
} from "./utils/convertkit";
import { getVideosMetadata, YouTubeVideoMetadata } from "./utils/youtube";
import {
  classifyVideo,
  getCaptionGraceHours,
  getMinDurationMinutes,
  getSkipVideoIds,
  hoursSinceEnded,
} from "./utils/townhall";
import {
  ProcessResult,
  formatAlert,
  formatCrashAlert,
  formatReport,
  publishAlert,
  publishStepSummary,
  runFailed,
} from "./utils/report";
import { processVideos } from "./retro";

/**
 * Finds the channel's recent town halls and reports which ones do NOT yet have
 * a ConvertKit broadcast. Use the printed `yarn retro` line to catch up, or
 * pass `--auto-run` to summarize them straight away (what the scheduled
 * workflow does).
 *
 * Usage:
 *   yarn missing                  # default lookback (60 days, 50 results per search)
 *   yarn missing --days=180
 *   yarn missing --max=100
 *   yarn missing --auto-run       # find missing + process them automatically
 */

interface SearchItem {
  id?: { videoId?: string };
}

interface SearchResponse {
  items?: SearchItem[];
  nextPageToken?: string;
}

export interface Candidate {
  videoId: string;
  /** Returned by the "completed live streams" search. */
  fromLiveSearch: boolean;
}

export interface SkippedVideo {
  video: YouTubeVideoMetadata;
  reason: string;
}

export interface Discovery {
  /** Oldest first, so summaries are created in chronological order. */
  townHalls: YouTubeVideoMetadata[];
  notTownHalls: SkippedVideo[];
  inProgress: SkippedVideo[];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseFlag(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const v = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export async function searchChannelVideos(
  channelId: string,
  apiKey: string,
  publishedAfterIso: string,
  maxPerQuery: number
): Promise<Candidate[]> {
  // Two searches, deduped: completed live streams + anything matching
  // "town hall". Both are limited to the configured channel. Neither is
  // trusted to return only town halls; `classifyVideo` decides that.
  const queries: Array<{ live: boolean; params: Record<string, string> }> = [
    {
      live: true,
      params: {
        part: "snippet",
        channelId,
        eventType: "completed",
        type: "video",
        order: "date",
        maxResults: "50",
        publishedAfter: publishedAfterIso,
        key: apiKey,
      },
    },
    {
      live: false,
      params: {
        part: "snippet",
        channelId,
        type: "video",
        order: "date",
        maxResults: "50",
        publishedAfter: publishedAfterIso,
        q: "town hall",
        key: apiKey,
      },
    },
  ];

  const candidates = new Map<string, Candidate>();

  for (const { live, params } of queries) {
    let pageToken: string | undefined = undefined;
    let collected = 0;
    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const resp = await fetch(url.toString());
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`YouTube API error ${resp.status}: ${text}`);
      }
      const data = (await resp.json()) as SearchResponse;
      for (const item of data.items || []) {
        const videoId = item.id?.videoId;
        if (!videoId) continue;
        collected++;
        const existing = candidates.get(videoId);
        candidates.set(videoId, {
          videoId,
          fromLiveSearch: live || Boolean(existing?.fromLiveSearch),
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken && collected < maxPerQuery);
  }

  return [...candidates.values()];
}

export async function discoverTownHalls(options: {
  channelId: string;
  youtubeApiKey: string;
  publishedAfterIso: string;
  maxPerQuery: number;
  minDurationMinutes?: number;
  skipVideoIds?: ReadonlySet<string>;
}): Promise<Discovery> {
  const candidates = await searchChannelVideos(
    options.channelId,
    options.youtubeApiKey,
    options.publishedAfterIso,
    options.maxPerQuery
  );

  const metadata = await getVideosMetadata(
    candidates.map((c) => c.videoId),
    options.youtubeApiKey
  );

  const discovery: Discovery = {
    townHalls: [],
    notTownHalls: [],
    inProgress: [],
  };

  for (const candidate of candidates) {
    const video = metadata.get(candidate.videoId);
    // Deleted or made private since the search index last saw it.
    if (!video) continue;

    const classification = classifyVideo(video, {
      minDurationMinutes: options.minDurationMinutes,
      skipVideoIds: options.skipVideoIds,
      knownLiveStream: candidate.fromLiveSearch,
    });

    if (classification.kind === "townhall") {
      discovery.townHalls.push(video);
    } else if (classification.kind === "in-progress") {
      discovery.inProgress.push({ video, reason: classification.reason });
    } else {
      discovery.notTownHalls.push({ video, reason: classification.reason });
    }
  }

  discovery.townHalls.sort((a, b) =>
    (a.publishedAt || "").localeCompare(b.publishedAt || "")
  );

  return discovery;
}

/**
 * Finished streams that YouTube still reports no length for, long after they
 * ended. Without a length they cannot be told apart from clips, so they are
 * never summarized. Left alone, that would be a town hall skipped in silence
 * every day, so past the grace period it is reported as a failure instead.
 */
export function findStalledStreams(
  inProgress: SkippedVideo[],
  summarizedVideoIds: { has(videoId: string): boolean },
  graceHours: number,
  now: Date = new Date()
): ProcessResult[] {
  const stalled: ProcessResult[] = [];

  for (const { video } of inProgress) {
    if (
      video.liveBroadcastContent === "live" ||
      video.liveBroadcastContent === "upcoming" ||
      summarizedVideoIds.has(video.id)
    ) {
      continue;
    }

    const hours = hoursSinceEnded(video, now);
    if (hours === null || hours < graceHours) continue;

    stalled.push({
      videoInput: video.id,
      videoId: video.id,
      title: video.title,
      status: "failed",
      hoursSinceEnded: hours,
      error:
        "YouTube still reports no length for this stream, so it cannot be confirmed as a town hall. " +
        `If it is one, summarize it by id: yarn retro ${video.id} (or the workflow's video_ids input).`,
    });
  }

  return stalled;
}

function describe(video: YouTubeVideoMetadata): string {
  return `${video.id}  ${video.publishedAt}  ${video.title}`;
}

async function main() {
  const days = parseFlag("days", 60);
  const max = parseFlag("max", 50);
  const autoRun = hasFlag("auto-run");

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const convertKitApiKey =
    process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY;
  const channelId =
    process.env.YOUTUBE_CHANNEL_ID || process.env.ALLOWED_YOUTUBE_CHANNEL_ID;

  if (!youtubeApiKey) {
    throw new Error("YOUTUBE_API_KEY environment variable is required");
  }
  if (!convertKitApiKey) {
    throw new Error(
      "CONVERT_KIT_API_KEY or CONVERT_KIT_V4_API_KEY environment variable is required"
    );
  }
  if (!channelId) {
    throw new Error(
      "YOUTUBE_CHANNEL_ID (or ALLOWED_YOUTUBE_CHANNEL_ID) is required"
    );
  }
  if (autoRun && !process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  const publishedAfter = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();
  const minDurationMinutes = getMinDurationMinutes();

  console.log(
    `Looking up videos from channel ${channelId} published in the last ${days} days...`
  );
  const discovery = await discoverTownHalls({
    channelId,
    youtubeApiKey,
    publishedAfterIso: publishedAfter,
    maxPerQuery: max,
    minDurationMinutes,
    skipVideoIds: getSkipVideoIds(),
  });

  console.log(
    `Found ${discovery.townHalls.length} town hall(s). ` +
      `Ignored ${discovery.notTownHalls.length} other channel video(s) and ` +
      `${discovery.inProgress.length} stream(s) YouTube has not finished with.`
  );

  if (discovery.notTownHalls.length > 0) {
    console.log("\nNot town halls (ignored):");
    for (const { video, reason } of discovery.notTownHalls) {
      console.log(`  ·  ${describe(video)} — ${reason}`);
    }
  }
  if (discovery.inProgress.length > 0) {
    console.log("\nNot finished yet (will be looked at again next run):");
    for (const { video, reason } of discovery.inProgress) {
      console.log(`  ⏳ ${describe(video)} — ${reason}`);
    }
  }

  const broadcasts = indexBroadcastsByVideoId(
    await getTownHallBroadcasts(convertKitApiKey)
  );
  const present = discovery.townHalls.filter((v) => broadcasts.has(v.id));
  const missing = discovery.townHalls.filter((v) => !broadcasts.has(v.id));

  console.log("\n" + "=".repeat(72));
  console.log(`Already summarized: ${present.length}`);
  for (const v of present) console.log(`  ✅ ${describe(v)}`);

  console.log("");
  console.log(`Missing summaries: ${missing.length}`);
  for (const v of missing) console.log(`  ❌ ${describe(v)}`);

  const ignoredNote =
    discovery.notTownHalls.length > 0
      ? `\n\nIgnored ${discovery.notTownHalls.length} channel video(s) that are not town halls (shorter than ${minDurationMinutes} minutes, or uploads not titled Town Hall).`
      : "";

  const graceHours = getCaptionGraceHours();
  const stalled = findStalledStreams(discovery.inProgress, broadcasts, graceHours);

  if (missing.length === 0 && stalled.length === 0) {
    if (autoRun) {
      publishStepSummary(
        `### Town hall summarizer\nNo town halls waiting for a summary.${ignoredNote}`
      );
    }
    return;
  }

  const ids = missing.map((v) => v.id);

  if (!autoRun) {
    if (ids.length > 0) {
      console.log("");
      console.log("To catch up, run (locally or in Docker):");
      console.log("");
      console.log(`  yarn retro ${ids.join(" ")}`);
      console.log("  # or, in Docker:");
      console.log(`  yarn docker:retro ${ids.join(" ")}`);
      console.log("");
    }
    return;
  }

  const results = [...stalled];
  if (ids.length > 0) {
    console.log("\n--auto-run flag detected. Running retro now...");
    results.push(
      ...(await processVideos(ids, {
        youtubeApiKey,
        convertKitApiKey,
        captionGraceHours: graceHours,
      }))
    );
  }

  const report = formatReport(results);
  console.log("\n" + "=".repeat(72));
  console.log(report);
  console.log("\nResults:");
  console.log(JSON.stringify(results, null, 2));

  publishStepSummary(`### Town hall summarizer\n${report}${ignoredNote}`);

  if (runFailed(results)) {
    publishAlert(formatAlert(results));
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    const alert = formatCrashAlert(err);
    publishStepSummary(`### Town hall summarizer\n${alert}`);
    publishAlert(alert);
    process.exit(1);
  });
}
