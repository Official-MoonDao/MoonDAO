import "dotenv/config";
import {
  ConvertKitBroadcast,
  deleteBroadcast,
  extractBroadcastVideoId,
  getTownHallBroadcasts,
} from "./utils/convertkit";
import { getVideosMetadata, YouTubeVideoMetadata } from "./utils/youtube";
import { formatDuration, getMinDurationMinutes } from "./utils/townhall";

/**
 * Lists — and with `--delete`, removes — "Town Hall Summary" broadcasts that
 * were generated from short clips rather than town halls.
 *
 * The scheduled runs of 2026-11-06, -13 and -20 summarized the short clips the
 * channel had started publishing, and each summary went live on /townhall.
 * This is the cleanup for those. It only ever touches a broadcast whose video
 * YouTube reports as shorter than the town hall minimum; anything it cannot
 * look up is kept.
 *
 * Usage:
 *   yarn prune-clips            # dry run: print what would be deleted
 *   yarn prune-clips --delete   # delete them
 */

export interface ClipBroadcast {
  broadcast: ConvertKitBroadcast;
  video: YouTubeVideoMetadata;
}

export function findClipBroadcasts(
  broadcasts: ConvertKitBroadcast[],
  videos: Map<string, YouTubeVideoMetadata>,
  minDurationMinutes: number
): ClipBroadcast[] {
  const clips: ClipBroadcast[] = [];

  for (const broadcast of broadcasts) {
    const videoId = extractBroadcastVideoId(broadcast);
    const video = videoId ? videos.get(videoId) : undefined;
    if (!video || !video.durationSeconds) continue;
    if (video.durationSeconds < minDurationMinutes * 60) {
      clips.push({ broadcast, video });
    }
  }

  return clips;
}

async function main() {
  const shouldDelete = process.argv.includes("--delete");
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const convertKitApiKey =
    process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY;

  if (!youtubeApiKey) {
    throw new Error("YOUTUBE_API_KEY environment variable is required");
  }
  if (!convertKitApiKey) {
    throw new Error(
      "CONVERT_KIT_API_KEY or CONVERT_KIT_V4_API_KEY environment variable is required"
    );
  }

  const minDurationMinutes = getMinDurationMinutes();
  const broadcasts = await getTownHallBroadcasts(convertKitApiKey);
  const videoIds = broadcasts
    .map(extractBroadcastVideoId)
    .filter((id): id is string => Boolean(id));
  const videos = await getVideosMetadata(videoIds, youtubeApiKey);
  const clips = findClipBroadcasts(broadcasts, videos, minDurationMinutes);

  console.log(
    `${broadcasts.length} town hall broadcast(s) in ConvertKit; ` +
      `${clips.length} summarize a video shorter than ${minDurationMinutes} minutes.`
  );

  if (clips.length === 0) return;

  console.log("");
  for (const { broadcast, video } of clips) {
    console.log(
      `  ${broadcast.id}  ${video.id}  ${formatDuration(
        video.durationSeconds ?? 0
      ).padStart(7)}  ${video.title}`
    );
  }
  console.log("");

  if (!shouldDelete) {
    console.log("Dry run. Nothing was deleted. Re-run with --delete to remove these.");
    return;
  }

  let failed = 0;
  for (const { broadcast, video } of clips) {
    try {
      await deleteBroadcast(broadcast.id, convertKitApiKey);
    } catch (error) {
      failed++;
      console.error(
        `❌ Could not delete broadcast ${broadcast.id} (${video.id}):`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(`Deleted ${clips.length - failed} of ${clips.length} broadcast(s).`);
  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
