import express, { Request, Response } from "express";
import OpenAI from "openai";
import {
  extractAudioUrl,
  transcribeAudio,
  summarizeTranscript,
  formatSummaryForConvertKit,
} from "./utils/processing";
import {
  createConvertKitBroadcast,
  ConvertKitBroadcast,
} from "./utils/convertkit";
import { getVideoMetadata, validateVideoChannel } from "./utils/youtube";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ProcessRequestBody {
  videoId: string;
  videoTitle?: string;
  videoDate?: string;
  openaiModel?: string;
  whisperModel?: string;
  convertKitApiKey?: string;
  convertKitTagId?: string;
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
        openaiModel = "gpt-4",
        whisperModel = "whisper-1",
        convertKitApiKey,
        convertKitTagId,
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

      // Step 1: Extract audio URL
      const audioUrl = await extractAudioUrl(videoId);

      // Step 2: Transcribe
      const transcript = await transcribeAudio(audioUrl, openai, whisperModel);

      if (!transcript || transcript.trim().length === 0) {
        return res
          .status(500)
          .json({ error: "Empty transcript received" } as any);
      }

      // Step 3: Summarize
      const summary = await summarizeTranscript(
        transcript,
        openai,
        openaiModel
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

      // Step 5: Create broadcast (skip in test mode)
      let broadcast: ConvertKitBroadcast | null = null;
      if (!testMode) {
        broadcast = await createConvertKitBroadcast(
          broadcastSubject,
          formattedSummary,
          convertKitApiKey!,
          convertKitTagId
        );
        console.log(`Broadcast created successfully: ${broadcast.id}`);
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

// Legacy endpoint: Just extract audio URL (for backward compatibility)
app.get("/", async (req: Request, res: Response) => {
  const { videoId } = req.query;

  if (!videoId || typeof videoId !== "string") {
    return res.status(400).send("videoId parameter is required");
  }

  try {
    const audioUrl = await extractAudioUrl(videoId);
    res.setHeader("Content-Type", "text/plain");
    res.send(audioUrl);
  } catch (error) {
    console.error("Error extracting audio:", error);
    res
      .status(500)
      .send(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
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
