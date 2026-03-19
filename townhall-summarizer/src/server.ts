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
  summarizeTranscript,
  formatSummaryForConvertKit,
} from "./utils/processing";
import {
  createConvertKitBroadcast,
  ConvertKitBroadcast,
} from "./utils/convertkit";
import { getVideoMetadata, validateVideoChannel } from "./utils/youtube";

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

app.post(
  "/process",
  async (
    req: Request<{}, ProcessResponse, ProcessRequestBody>,
    res: Response
  ) => {
    try {
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

      const allowedChannelId = process.env.ALLOWED_YOUTUBE_CHANNEL_ID;
      if (allowedChannelId) {
        const youtubeApiKey = process.env.YOUTUBE_API_KEY;
        if (!youtubeApiKey) {
          return res.status(400).json({
            error: "YOUTUBE_API_KEY is required for channel validation",
          } as any);
        }

        const videoMetadata = await getVideoMetadata(videoId, youtubeApiKey);
        if (!videoMetadata) {
          return res.status(404).json({ error: "Video not found" } as any);
        }

        const isValidChannel = await validateVideoChannel(
          videoMetadata,
          allowedChannelId
        );
        if (!isValidChannel) {
          return res.status(403).json({
            error: "Video is not from the allowed YouTube channel",
            channelId: videoMetadata.channelId,
            channelTitle: videoMetadata.channelTitle,
          } as any);
        }
      }

      console.log(`Starting full pipeline for video: ${videoId}`);

      // Step 1: Download and transcribe audio
      const transcript = await transcribeAudio(videoId, groq, whisperModel);

      if (!transcript || transcript.trim().length === 0) {
        return res
          .status(500)
          .json({ error: "Empty transcript received" } as any);
      }

      // Step 3: Summarize
      const summary = await summarizeTranscript(
        transcript,
        groq,
        groqModel
      );

      if (!summary) {
        return res
          .status(500)
          .json({ error: "Failed to generate summary" } as any);
      }

      // Step 4: Format summary
      const formattedSummary = formatSummaryForConvertKit(
        summary,
        videoTitle || "Town Hall",
        videoDate || new Date().toISOString(),
        videoId
      );

      const broadcastSubject = `Town Hall Summary - ${new Date(
        videoDate || new Date()
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`;

      // Step 5: Create broadcast draft (skip in test mode)
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

      console.log(`Pipeline completed successfully for video: ${videoId}`);

      return res.status(200).json({
        success: true,
        videoId: videoId,
        broadcastId: broadcast?.id || null,
        summary: summary.substring(0, 200) + "...",
        fullSummary: testMode ? summary : undefined,
        formattedSummary: testMode ? formattedSummary : undefined,
        transcript: testMode ? transcript.substring(0, 500) + "..." : undefined,
        testMode: testMode,
      });
    } catch (error) {
      console.error("Error in process pipeline:", error);
      return res.status(500).json({
        error: "Pipeline failed",
        message: error instanceof Error ? error.message : "Unknown error",
      } as any);
    }
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

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`Downloading audio for video: ${videoId}`);
    await execAsync(
      `yt-dlp -f "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio" -o "${tempFile}" --no-warnings "${videoUrl}"`
    );

    const audioBuffer = await readFile(tempFile);

    // Clean up temp file
    try {
      await unlink(tempFile);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    res.setHeader("Content-Type", "audio/m4a");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audio-${videoId}.m4a"`
    );
    res.status(200).send(audioBuffer);
  } catch (error) {
    // Clean up temp file on error
    try {
      await unlink(tempFile).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }

    return res.status(500).json({
      error: "Failed to extract audio",
      message: error instanceof Error ? error.message : "Unknown error",
    });
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
