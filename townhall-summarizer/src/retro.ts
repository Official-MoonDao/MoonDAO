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
  extractAudioUrl,
  transcribeAudio,
  summarizeTranscript,
  formatSummaryForConvertKit,
} from "./utils/processing";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ProcessResult {
  videoUrl: string;
  videoId?: string;
  success: boolean;
  error?: string;
  broadcastId?: string;
}

async function processVideo(
  videoUrl: string,
  youtubeApiKey: string,
  convertKitApiKey: string,
  tagId: string | undefined,
  openaiModel: string,
  whisperModel: string
): Promise<ProcessResult> {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return {
        videoUrl,
        success: false,
        error: "Invalid video URL or ID",
      };
    }

    const existing = await findBroadcastByVideoId(
      videoId,
      convertKitApiKey,
      tagId
    );
    if (existing) {
      return {
        videoUrl,
        videoId,
        success: false,
        error: "Video already processed",
        broadcastId: existing.id,
      };
    }

    const videoMetadata = await getVideoMetadata(videoId, youtubeApiKey);
    if (!videoMetadata) {
      return {
        videoUrl,
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
          videoUrl,
          videoId,
          success: false,
          error: `Video is not from the allowed YouTube channel. Channel: ${videoMetadata.channelTitle} (${videoMetadata.channelId})`,
        };
      }
    }

    console.log(`\nProcessing video: ${videoMetadata.title} (${videoId})`);

    const audioUrl = await extractAudioUrl(videoId);
    const transcript = await transcribeAudio(audioUrl, openai, whisperModel);
    const summary = await summarizeTranscript(transcript, openai, openaiModel);
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
      convertKitApiKey,
      tagId
    );

    return {
      videoUrl,
      videoId,
      success: true,
      broadcastId: broadcast.id,
    };
  } catch (error) {
    return {
      videoUrl,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function main() {
  const videoUrls = process.argv.slice(2);

  if (videoUrls.length === 0) {
    console.error("Usage: npm run retro <videoUrl1> [videoUrl2] ...");
    console.error("Example: npm run retro https://youtube.com/watch?v=abc123");
    process.exit(1);
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const convertKitApiKey =
    process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || "gpt-4";
  const whisperModel = process.env.WHISPER_MODEL || "whisper-1";
  const tagId = process.env.TOWNHALL_CONVERTKIT_TAG_ID;

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

  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log(`Processing ${videoUrls.length} video(s)...\n`);

  const results: ProcessResult[] = [];

  for (const videoUrl of videoUrls) {
    const result = await processVideo(
      videoUrl,
      youtubeApiKey,
      convertKitApiKey,
      tagId,
      openaiModel,
      whisperModel
    );
    results.push(result);
  }

  console.log("\n" + "=".repeat(50));
  console.log("Retroactive processing completed!");
  console.log("=".repeat(50));
  console.log(`Total: ${videoUrls.length}`);
  console.log(`Successful: ${results.filter((r) => r.success).length}`);
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
