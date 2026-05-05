import "dotenv/config";
import { findBroadcastByVideoId } from "./utils/convertkit";
import { spawnSync } from "child_process";
import { resolve } from "path";

/**
 * Lists town-hall-style videos from the configured YouTube channel and reports
 * which ones do NOT yet have a ConvertKit broadcast. Use the printed
 * `yarn retro` line to catch up.
 *
 * Usage:
 *   yarn missing                  # default lookback (60 days, 50 results)
 *   yarn missing --days=180
 *   yarn missing --max=100
 *   yarn missing --auto-run       # find missing + process them automatically
 */

interface SearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    publishedAt?: string;
    channelId?: string;
  };
}

interface SearchResponse {
  items?: SearchItem[];
  nextPageToken?: string;
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

async function fetchRecentVideos(
  channelId: string,
  apiKey: string,
  publishedAfterIso: string,
  maxResults: number
): Promise<SearchItem[]> {
  const collected: SearchItem[] = [];
  let pageToken: string | undefined = undefined;

  // We try two queries and dedupe: completed live streams + "town hall" search.
  // Both are limited to the configured channel.
  const queries: Array<Record<string, string>> = [
    {
      part: "snippet",
      channelId,
      eventType: "completed",
      type: "video",
      order: "date",
      maxResults: "50",
      publishedAfter: publishedAfterIso,
      key: apiKey,
    },
    {
      part: "snippet",
      channelId,
      type: "video",
      order: "date",
      maxResults: "50",
      publishedAfter: publishedAfterIso,
      q: "town hall",
      key: apiKey,
    },
  ];

  for (const params of queries) {
    pageToken = undefined;
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
        if (item.id?.videoId) collected.push(item);
      }
      pageToken = data.nextPageToken;
    } while (pageToken && collected.length < maxResults);
  }

  // Dedupe by videoId, preserve newest-first order.
  const seen = new Set<string>();
  const deduped: SearchItem[] = [];
  for (const item of collected) {
    const id = item.id?.videoId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(item);
  }

  // Sort newest-first.
  deduped.sort((a, b) => {
    const da = a.snippet?.publishedAt || "";
    const db = b.snippet?.publishedAt || "";
    return db.localeCompare(da);
  });

  return deduped.slice(0, maxResults);
}

async function main() {
  const days = parseFlag("days", 60);
  const max = parseFlag("max", 50);

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const convertKitApiKey =
    process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID ||
    process.env.ALLOWED_YOUTUBE_CHANNEL_ID;

  if (!youtubeApiKey) {
    console.error("Error: YOUTUBE_API_KEY environment variable is required");
    process.exit(1);
  }
  if (!convertKitApiKey) {
    console.error(
      "Error: CONVERT_KIT_API_KEY or CONVERT_KIT_V4_API_KEY environment variable is required"
    );
    process.exit(1);
  }
  if (!channelId) {
    console.error(
      "Error: YOUTUBE_CHANNEL_ID (or ALLOWED_YOUTUBE_CHANNEL_ID) is required"
    );
    process.exit(1);
  }

  const publishedAfter = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();

  console.log(
    `Looking up videos from channel ${channelId} published in the last ${days} days (max ${max})...`
  );
  const videos = await fetchRecentVideos(
    channelId,
    youtubeApiKey,
    publishedAfter,
    max
  );

  if (videos.length === 0) {
    console.log("No videos found in that window.");
    return;
  }

  console.log(`Found ${videos.length} candidate video(s). Checking ConvertKit...\n`);

  const missing: SearchItem[] = [];
  const present: SearchItem[] = [];

  for (const v of videos) {
    const videoId = v.id!.videoId!;
    const existing = await findBroadcastByVideoId(videoId, convertKitApiKey);
    if (existing) present.push(v);
    else missing.push(v);
  }

  console.log("=".repeat(72));
  console.log(`Already summarized: ${present.length}`);
  for (const v of present) {
    const id = v.id!.videoId!;
    console.log(`  ✅ ${id}  ${v.snippet?.publishedAt}  ${v.snippet?.title}`);
  }

  console.log("");
  console.log(`Missing summaries: ${missing.length}`);
  for (const v of missing) {
    const id = v.id!.videoId!;
    console.log(`  ❌ ${id}  ${v.snippet?.publishedAt}  ${v.snippet?.title}`);
  }

  if (missing.length > 0) {
    // Sort oldest-first so retro processes them in chronological order.
    const ordered = [...missing].sort((a, b) => {
      const da = a.snippet?.publishedAt || "";
      const db = b.snippet?.publishedAt || "";
      return da.localeCompare(db);
    });
    const ids = ordered.map((v) => v.id!.videoId!).join(" ");
    console.log("");
    console.log("To catch up, run (locally or in Docker):");
    console.log("");
    console.log(`  yarn retro ${ids}`);
    console.log("  # or, in Docker:");
    console.log(`  yarn docker:retro ${ids}`);
    console.log("");

    if (hasFlag("auto-run")) {
      console.log("--auto-run flag detected. Running retro now...");
      const retroScript = resolve(__dirname, "retro.ts");
      const result = spawnSync(
        process.execPath,
        [resolve(__dirname, "../node_modules/.bin/ts-node"), retroScript, ...ids.split(" ")],
        { stdio: "inherit" }
      );
      if (result.status !== 0) {
        console.error("Retro run failed with exit code", result.status);
        process.exit(result.status ?? 1);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
