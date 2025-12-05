import "dotenv/config";
import {
  extractVideoId,
  getVideoMetadata,
  validateVideoChannel,
} from "./utils/youtube";
import {
  findBroadcastByVideoId,
  createConvertKitBroadcast,
} from "./utils/convertkit";
import {
  transcribeAudio,
  summarizeTranscript,
  formatSummaryForConvertKit,
} from "./utils/processing";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface ProcessResult {
  videoInput: string;
  videoId?: string;
  success: boolean;
  error?: string;
  broadcastId?: string;
}

async function processVideo(
  videoInput: string,
  youtubeApiKey: string,
  convertKitApiKey: string,
  groqModel: string,
  whisperModel: string
): Promise<ProcessResult> {
  try {
    const videoId = extractVideoId(videoInput);
    if (!videoId) {
      return {
        videoInput,
        success: false,
        error: "Invalid video URL or ID",
      };
    }

    const existing = await findBroadcastByVideoId(videoId, convertKitApiKey);
    if (existing) {
      console.log(
        `⏭️  Skipping ${videoId}: Already processed (broadcast ID: ${existing.id})`
      );
      return {
        videoInput,
        videoId,
        success: false,
        error: "Video already processed",
        broadcastId: existing.id,
      };
    }

    const videoMetadata = await getVideoMetadata(videoId, youtubeApiKey);
    if (!videoMetadata) {
      return {
        videoInput,
        videoId,
        success: false,
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
          success: false,
          error: `Video is not from the allowed YouTube channel. Channel: ${videoMetadata.channelTitle} (${videoMetadata.channelId})`,
        };
      }
    }

    console.log(`\nProcessing video: ${videoMetadata.title} (${videoId})`);

    const transcript = await transcribeAudio(videoId, groq, whisperModel);
    const summary = await summarizeTranscript(transcript, groq, groqModel);
    const formattedSummary = formatSummaryForConvertKit(
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

    const broadcast = await createConvertKitBroadcast(
      broadcastSubject,
      formattedSummary,
      convertKitApiKey
    );

    return {
      videoInput,
      videoId,
      success: true,
      broadcastId: broadcast.id,
    };
  } catch (error) {
    return {
      videoInput,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
  const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const whisperModel = process.env.WHISPER_MODEL || "whisper-large-v3";

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

  console.log(`Fetching metadata for ${videoInputs.length} video(s)...\n`);

  // Fetch metadata for all videos first to sort them by published date
  interface VideoWithMetadata {
    videoInput: string;
    videoId: string;
    metadata: NonNullable<Awaited<ReturnType<typeof getVideoMetadata>>>;
  }

  const videosWithMetadata: VideoWithMetadata[] = [];
  const invalidVideos: string[] = [];

  for (const videoInput of videoInputs) {
    const videoId = extractVideoId(videoInput);
    if (!videoId) {
      invalidVideos.push(videoInput);
      continue;
    }

    try {
      const metadata = await getVideoMetadata(videoId, youtubeApiKey);
      if (!metadata) {
        invalidVideos.push(videoInput);
        continue;
      }

      const allowedChannelId = process.env.ALLOWED_YOUTUBE_CHANNEL_ID;
      if (allowedChannelId) {
        const isValidChannel = await validateVideoChannel(
          metadata,
          allowedChannelId
        );
        if (!isValidChannel) {
          console.warn(
            `Skipping video ${videoId}: not from allowed channel. Channel: ${metadata.channelTitle} (${metadata.channelId})`
          );
          invalidVideos.push(videoInput);
          continue;
        }
      }

      // TypeScript now knows metadata is non-null here
      videosWithMetadata.push({ videoInput, videoId, metadata });
    } catch (error) {
      console.warn(`Failed to fetch metadata for ${videoInput}:`, error);
      invalidVideos.push(videoInput);
    }
  }

  if (invalidVideos.length > 0) {
    console.warn(
      `\n⚠️  Warning: ${invalidVideos.length} invalid video(s) will be skipped:`
    );
    invalidVideos.forEach((v) => console.warn(`  - ${v}`));
  }

  // Process videos in the order provided (preserves user's intended order)
  console.log(
    `\nProcessing ${videosWithMetadata.length} video(s) in provided order...\n`
  );
  console.log("Processing order:");
  videosWithMetadata.forEach((v, i) => {
    const date = new Date(v.metadata.publishedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    console.log(`  ${i + 1}. ${v.metadata.title} (${date})`);
  });
  console.log();

  const results: ProcessResult[] = [];

  for (const { videoInput } of videosWithMetadata) {
    const result = await processVideo(
      videoInput,
      youtubeApiKey,
      convertKitApiKey,
      groqModel,
      whisperModel
    );
    results.push(result);
  }

  // Add errors for invalid videos
  for (const videoInput of invalidVideos) {
    results.push({
      videoInput,
      success: false,
      error: "Invalid video URL/ID or metadata not found",
    });
  }

  console.log("\n" + "=".repeat(50));
  console.log("Retroactive processing completed!");
  console.log("=".repeat(50));
  console.log(`Total videos provided: ${videoInputs.length}`);
  console.log(
    `Successfully processed: ${results.filter((r) => r.success).length}`
  );
  console.log(`Failed: ${results.filter((r) => !r.success).length}`);
  console.log("\nResults:");
  console.log(JSON.stringify(results, null, 2));

  const failedCount = results.filter((r) => !r.success).length;
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
