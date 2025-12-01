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
  tagId: string | undefined,
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

    const existing = await findBroadcastByVideoId(
      videoId,
      convertKitApiKey,
      tagId
    );
    if (existing) {
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
      convertKitApiKey,
      tagId
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

  if (!process.env.GROQ_API_KEY) {
    console.error("Error: GROQ_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log(`Processing ${videoInputs.length} video(s)...\n`);

  const results: ProcessResult[] = [];

  for (const videoInput of videoInputs) {
    const result = await processVideo(
      videoInput,
      youtubeApiKey,
      convertKitApiKey,
      tagId,
      groqModel,
      whisperModel
    );
    results.push(result);
  }

  console.log("\n" + "=".repeat(50));
  console.log("Retroactive processing completed!");
  console.log("=".repeat(50));
  console.log(`Total: ${videoInputs.length}`);
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
