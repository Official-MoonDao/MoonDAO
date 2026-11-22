import "dotenv/config";
import {
  extractVideoId,
  getVideoMetadata,
  validateVideoChannel,
  YouTubeVideoMetadata,
} from "./utils/youtube";
import {
  findBroadcastByVideoId,
  createConvertKitBroadcast,
} from "./utils/convertkit";
import {
  getTranscript,
  summarizeTranscript,
  formatSummaryForConvertKit,
  TranscriptNotReadyError,
} from "./utils/processing";
import { DEFAULT_MODELS } from "./utils/config";
import { hoursSinceEnded } from "./utils/townhall";
import {
  ProcessResult,
  formatAlert,
  formatReport,
  publishAlert,
  publishStepSummary,
  runFailed,
} from "./utils/report";
import Groq from "groq-sdk";

export interface ProcessDeps {
  findBroadcastByVideoId: typeof findBroadcastByVideoId;
  getVideoMetadata: typeof getVideoMetadata;
  getTranscript: (videoId: string) => Promise<string>;
  summarizeTranscript: (transcript: string) => Promise<string>;
  createConvertKitBroadcast: typeof createConvertKitBroadcast;
}

export interface ProcessOptions {
  youtubeApiKey: string;
  convertKitApiKey: string;
  groqModel?: string;
  whisperModel?: string;
  /**
   * Set by the scheduled run. A stream that ended less than this many hours
   * ago and has no captions yet is reported as `pending` — the next run picks
   * it up — instead of `failed`. Leave unset when a person asked for specific
   * videos: they want to know now.
   */
  captionGraceHours?: number;
  now?: Date;
  deps?: Partial<ProcessDeps>;
}

function resolveDeps(options: ProcessOptions): ProcessDeps {
  const groqModel =
    options.groqModel || process.env.GROQ_MODEL || DEFAULT_MODELS.llm;
  const whisperModel =
    options.whisperModel || process.env.WHISPER_MODEL || DEFAULT_MODELS.whisper;

  let groq: Groq | null = null;
  const getGroq = () =>
    (groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY }));

  return {
    findBroadcastByVideoId,
    getVideoMetadata,
    getTranscript: (videoId) => getTranscript(videoId, getGroq(), whisperModel),
    summarizeTranscript: (transcript) =>
      summarizeTranscript(transcript, getGroq(), groqModel),
    createConvertKitBroadcast,
    ...options.deps,
  };
}

async function processVideo(
  videoInput: string,
  options: ProcessOptions,
  deps: ProcessDeps
): Promise<ProcessResult> {
  const videoId = extractVideoId(videoInput);
  if (!videoId) {
    return { videoInput, status: "failed", error: "Invalid video URL or ID" };
  }

  let videoMetadata: YouTubeVideoMetadata | null = null;

  try {
    const existing = await deps.findBroadcastByVideoId(
      videoId,
      options.convertKitApiKey
    );
    if (existing) {
      console.log(
        `⏭️  Skipping ${videoId}: Already processed (broadcast ID: ${existing.id})`
      );
      return {
        videoInput,
        videoId,
        status: "already-processed",
        broadcastId: existing.id,
      };
    }

    videoMetadata = await deps.getVideoMetadata(videoId, options.youtubeApiKey);
    if (!videoMetadata) {
      return {
        videoInput,
        videoId,
        status: "failed",
        error: "Video metadata not found",
      };
    }

    const allowedChannelId = process.env.ALLOWED_YOUTUBE_CHANNEL_ID;
    if (allowedChannelId) {
      const isValidChannel = await validateVideoChannel(
        videoMetadata,
        allowedChannelId
      );
      if (!isValidChannel) {
        return {
          videoInput,
          videoId,
          title: videoMetadata.title,
          status: "failed",
          error: `Video is not from the allowed YouTube channel. Channel: ${videoMetadata.channelTitle} (${videoMetadata.channelId})`,
        };
      }
    }

    console.log(`\nProcessing video: ${videoMetadata.title} (${videoId})`);

    const transcript = await deps.getTranscript(videoId);
    const summary = await deps.summarizeTranscript(transcript);
    const formattedSummary = await formatSummaryForConvertKit(
      summary,
      videoMetadata.title,
      videoMetadata.publishedAt,
      videoId
    );

    const broadcastSubject = `Town Hall Summary - ${new Date(
      videoMetadata.publishedAt
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`;

    const broadcast = await deps.createConvertKitBroadcast(
      broadcastSubject,
      formattedSummary,
      options.convertKitApiKey
    );

    return {
      videoInput,
      videoId,
      title: videoMetadata.title,
      status: "created",
      broadcastId: broadcast.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const hours = videoMetadata
      ? hoursSinceEnded(videoMetadata, options.now)
      : null;
    const base = {
      videoInput,
      videoId,
      title: videoMetadata?.title,
      error: message,
      hoursSinceEnded: hours ?? undefined,
    };

    const withinGrace =
      error instanceof TranscriptNotReadyError &&
      options.captionGraceHours !== undefined &&
      hours !== null &&
      hours < options.captionGraceHours;

    if (withinGrace) {
      console.log(
        `⏳ ${videoId}: no captions yet ${Math.round(
          hours
        )}h after the stream ended. Leaving it for the next run.`
      );
      return { ...base, status: "pending" };
    }

    console.error(`❌ ${videoId}: ${message}`);
    return { ...base, status: "failed" };
  }
}

/**
 * Summarizes the given videos in order and reports what happened to each.
 * Never throws for a single video's failure; the caller decides what a
 * `failed` or `pending` result means for the run.
 */
export async function processVideos(
  videoInputs: string[],
  options: ProcessOptions
): Promise<ProcessResult[]> {
  const deps = resolveDeps(options);

  console.log(`\nProcessing ${videoInputs.length} video(s) in provided order...`);

  const results: ProcessResult[] = [];
  for (const videoInput of videoInputs) {
    results.push(await processVideo(videoInput, options, deps));
  }
  return results;
}

async function main() {
  const videoInputs = process.argv.slice(2);

  if (videoInputs.length === 0) {
    console.error("Usage: yarn retro <videoId1> [videoId2] ...");
    console.error("Example: yarn retro dQw4w9WgXcQ");
    console.error("Example: yarn retro dQw4w9WgXcQ KNejl2ThCf0");
    console.error(
      "Also accepts full URLs: yarn retro https://youtube.com/watch?v=dQw4w9WgXcQ"
    );
    process.exit(1);
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const convertKitApiKey =
    process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY;

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

  if (!process.env.GROQ_API_KEY) {
    console.error("Error: GROQ_API_KEY environment variable is required");
    process.exit(1);
  }

  const results = await processVideos(videoInputs, {
    youtubeApiKey,
    convertKitApiKey,
  });

  console.log("\n" + "=".repeat(50));
  console.log("Retroactive processing completed!");
  console.log("=".repeat(50));
  const report = formatReport(results);
  console.log(report);
  console.log("\nResults:");
  console.log(JSON.stringify(results, null, 2));

  publishStepSummary(`### Town hall summarizer\n${report}`);
  publishAlert(formatAlert(results));

  // A video that already has a summary is the desired end state, not an error.
  process.exit(runFailed(results) ? 1 : 0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
