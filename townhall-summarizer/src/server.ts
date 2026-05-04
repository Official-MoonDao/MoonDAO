import "dotenv/config";
import express, { Request, Response } from "express";
import Groq from "groq-sdk";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  transcribeAudio,
  getTranscript,
  summarizeTranscript,
  formatSummaryForConvertKit,
  getYtDlpCookieArgs,
} from "./utils/processing";
import {
  createConvertKitBroadcast,
  ConvertKitBroadcast,
} from "./utils/convertkit";
import { getVideoMetadata, validateVideoChannel } from "./utils/youtube";
import {
  sendDiscordNotification,
  sendDiscordErrorNotification,
  stripHtml,
} from "./utils/discord";

const execAsync = promisify(exec);

const app = express();
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface ProcessRequestBody {
  videoId: string;
  videoTitle?: string;
  videoDate?: string;
  groqModel?: string;
  whisperModel?: string;
  convertKitApiKey?: string;
  testMode?: boolean;
}

interface ProcessResponse {
  success: boolean;
  videoId: string;
  broadcastId: string | null;
  summary: string;
  fullSummary?: string;
  formattedSummary?: string;
  transcript?: string;
  testMode: boolean;
}

/**
 * Run the full transcribe → summarize → broadcast pipeline.
 *
 * Returns the result on success, or throws on any failure. Discord
 * notifications (success + error) happen here so callers don't need to
 * special-case them.
 */
async function runPipeline(args: {
  videoId: string;
  videoTitle?: string;
  videoDate?: string;
  groqModel: string;
  whisperModel: string;
  convertKitApiKey?: string;
  testMode: boolean;
}): Promise<ProcessResponse> {
  const {
    videoId,
    videoTitle,
    videoDate,
    groqModel,
    whisperModel,
    convertKitApiKey,
    testMode,
  } = args;

  let resolvedVideoDate = videoDate;
  let resolvedVideoTitle = videoTitle;
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  if (youtubeApiKey) {
    const videoMetadata = await getVideoMetadata(videoId, youtubeApiKey);
    if (!videoMetadata) {
      throw new Error("Video not found on YouTube");
    }

    if (!resolvedVideoDate && videoMetadata.publishedAt) {
      resolvedVideoDate = videoMetadata.publishedAt;
      console.log(`Using YouTube publish date: ${resolvedVideoDate}`);
    }

    if (!resolvedVideoTitle && videoMetadata.title) {
      resolvedVideoTitle = videoMetadata.title;
      console.log(`Using YouTube title: ${resolvedVideoTitle}`);
    }

    const allowedChannelId = process.env.ALLOWED_YOUTUBE_CHANNEL_ID;
    if (allowedChannelId) {
      const isValidChannel = await validateVideoChannel(
        videoMetadata,
        allowedChannelId
      );
      if (!isValidChannel) {
        throw new Error(
          `Video is not from the allowed YouTube channel: ${videoMetadata.channelTitle} (${videoMetadata.channelId})`
        );
      }
    }
  } else {
    console.warn("YOUTUBE_API_KEY not set, skipping metadata lookup");
  }

  resolvedVideoDate = resolvedVideoDate || new Date().toISOString();
  resolvedVideoTitle = resolvedVideoTitle || "Town Hall";

  console.log(`Starting full pipeline for video: ${videoId}`);

  const transcript = await getTranscript(videoId, groq, whisperModel);
  if (!transcript || transcript.trim().length === 0) {
    throw new Error("Empty transcript received");
  }

  const summary = await summarizeTranscript(transcript, groq, groqModel);
  if (!summary) {
    throw new Error("Failed to generate summary");
  }

  const formattedSummary = await formatSummaryForConvertKit(
    summary,
    resolvedVideoTitle,
    resolvedVideoDate,
    videoId
  );

  const broadcastSubject = `Town Hall Summary - ${new Date(
    resolvedVideoDate
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;

  let broadcast: ConvertKitBroadcast | null = null;
  if (!testMode) {
    broadcast = await createConvertKitBroadcast(
      broadcastSubject,
      formattedSummary,
      convertKitApiKey!
    );
  } else {
    console.log("Test mode: Skipping ConvertKit broadcast creation");
  }

  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (discordWebhookUrl && !testMode) {
    try {
      const summaryPreview = stripHtml(summary);
      await sendDiscordNotification(discordWebhookUrl, {
        videoTitle: resolvedVideoTitle,
        videoDate: resolvedVideoDate,
        videoId,
        summaryPreview,
        broadcastUrl: broadcast?.public_url,
      });
    } catch (discordError) {
      console.error(
        "Discord notification failed (non-fatal):",
        discordError
      );
    }
  }

  console.log(`Pipeline completed successfully for video: ${videoId}`);

  return {
    success: true,
    videoId,
    broadcastId: broadcast?.id || null,
    summary: summary.substring(0, 200) + "...",
    fullSummary: testMode ? summary : undefined,
    formattedSummary: testMode ? formattedSummary : undefined,
    transcript: testMode ? transcript.substring(0, 500) + "..." : undefined,
    testMode,
  };
}

app.post(
  "/process",
  async (
    req: Request<{}, ProcessResponse, ProcessRequestBody>,
    res: Response
  ) => {
    const {
      videoId,
      videoTitle,
      videoDate,
      groqModel = "llama-3.3-70b-versatile",
      whisperModel = "whisper-large-v3",
      convertKitApiKey,
      testMode = false,
    } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: "videoId is required" } as any);
    }

    if (!testMode && !convertKitApiKey) {
      return res
        .status(400)
        .json({ error: "convertKitApiKey is required" } as any);
    }

    // Test mode: run synchronously so callers get the transcript/summary back.
    if (testMode) {
      try {
        const result = await runPipeline({
          videoId,
          videoTitle,
          videoDate,
          groqModel,
          whisperModel,
          convertKitApiKey,
          testMode: true,
        });
        return res.status(200).json(result);
      } catch (error) {
        console.error("Error in process pipeline (test mode):", error);
        return res.status(500).json({
          error: "Pipeline failed",
          message: error instanceof Error ? error.message : "Unknown error",
        } as any);
      }
    }

    // Production: respond 202 immediately so callers (e.g. Vercel cron) don't
    // have to keep their connection open for ~10–15 minutes. The actual work
    // runs in the background; Discord notifies on success/failure.
    res.status(202).json({
      success: true,
      videoId,
      broadcastId: null,
      summary: "Processing in background",
      testMode: false,
    });

    runPipeline({
      videoId,
      videoTitle,
      videoDate,
      groqModel,
      whisperModel,
      convertKitApiKey,
      testMode: false,
    })
      .then((result) => {
        console.log(
          `Background pipeline finished for ${videoId} (broadcast: ${result.broadcastId})`
        );
      })
      .catch(async (error) => {
        console.error(
          `Background pipeline failed for ${videoId}:`,
          error
        );
        const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (discordWebhookUrl) {
          try {
            await sendDiscordErrorNotification(discordWebhookUrl, {
              videoId,
              videoTitle,
              videoDate,
              error: error instanceof Error ? error.message : String(error),
            });
          } catch (notifyError) {
            console.error(
              "Failed to send Discord error notification:",
              notifyError
            );
          }
        }
      });
  }
);

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ status: "running", service: "townhall-summarizer" });
});

// Audio extraction endpoint
app.get("/audio", async (req: Request, res: Response) => {
  const videoId = req.query.videoId as string;

  if (!videoId) {
    return res
      .status(400)
      .json({ error: "videoId query parameter is required" });
  }

  const tempFile = join(tmpdir(), `audio-${videoId}-${Date.now()}.m4a`);
  const { args: cookieArgs, cleanup: cleanupCookies } = await getYtDlpCookieArgs();

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`Downloading audio for video: ${videoId}`);
    await execAsync(
      `yt-dlp -f "bestaudio" -o "${tempFile}" --no-warnings --no-progress ${cookieArgs} "${videoUrl}"`,
      { maxBuffer: 50 * 1024 * 1024 } // 50MB buffer for fragmented livestream downloads
    );

    const audioBuffer = await readFile(tempFile);

    res.setHeader("Content-Type", "audio/m4a");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audio-${videoId}.m4a"`
    );
    res.status(200).send(audioBuffer);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to extract audio",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    // Clean up temp files (audio + cookies)
    await cleanupCookies();
    try { await unlink(tempFile); } catch { /* ignore */ }
  }
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Townhall summarizer service running on port ${PORT}`);
});
