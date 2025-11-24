import express, { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const execAsync = promisify(exec);

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

interface ConvertKitBroadcast {
  id: string;
  subject: string;
  content: string;
  public: boolean;
  published_at?: string;
  created_at: string;
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

// Extract audio URL from YouTube video
async function extractAudioUrl(videoId: string): Promise<string> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`Extracting audio URL for video: ${videoId}`);

  const { stdout } = await execAsync(
    `yt-dlp -g -f "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio" "${videoUrl}"`
  );

  const audioUrl = stdout.trim().split("\n")[0];
  if (!audioUrl) {
    throw new Error("Failed to extract audio URL - empty response");
  }

  console.log(`Successfully extracted audio URL for video: ${videoId}`);
  return audioUrl;
}

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(
  audioUrl: string,
  model: string = "whisper-1"
): Promise<string> {
  console.log("Fetching audio for transcription...");
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  // Create a File-like object for OpenAI SDK (Node.js 18+ has File global)
  const audioFile = new File([audioBuffer], "audio.mp3", {
    type: "audio/mpeg",
  });

  console.log("Transcribing audio with OpenAI Whisper...");
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: model,
    response_format: "text",
  });

  const transcript = transcription as string;
  console.log(`Transcription complete (${transcript.length} characters)`);
  return transcript;
}

// Summarize transcript using OpenAI
function getTownHallSummaryPrompt(transcript: string): string {
  return `You are summarizing a MoonDAO Town Hall meeting transcript. Please provide a comprehensive summary that includes:

1. **Key Topics Discussed**: List the main topics and themes covered in the town hall.

2. **Decisions Made**: Any decisions, votes, or resolutions that were reached during the meeting.

3. **Action Items**: Specific action items for community members, including:
   - Tasks assigned to individuals or teams
   - Deadlines mentioned
   - Next steps for the community

4. **Important Updates**: Significant announcements, updates, or news shared during the meeting.

5. **Next Steps**: What the community should expect or prepare for next.

Format your response in clear, well-structured sections with headers. Use bullet points for lists. Make it easy to scan and understand.

Transcript:
${transcript}

Please provide the summary now:`;
}

async function summarizeTranscript(
  transcript: string,
  model: string = "gpt-4"
): Promise<string> {
  console.log("Generating summary with OpenAI...");
  const prompt = getTownHallSummaryPrompt(transcript);

  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that summarizes Town Hall meetings for the MoonDAO community. Provide clear, structured summaries with actionable information.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const summary = response.choices[0]?.message?.content;
  if (!summary) {
    throw new Error("No summary generated from OpenAI");
  }

  console.log("Summary generated successfully");
  return summary;
}

// Format summary for ConvertKit
function formatSummaryForConvertKit(
  summary: string,
  videoTitle: string,
  videoDate: string,
  videoId?: string
): string {
  const formattedDate = new Date(videoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const videoIdComment = videoId ? `<!-- TOWNHALL_VIDEO_ID:${videoId} -->` : "";

  return `
${videoIdComment}
<h1>Town Hall Summary - ${formattedDate}</h1>
<h2>${videoTitle}</h2>

${summary}

<hr>

<p><em>This summary was automatically generated from the Town Hall transcript. Watch the full video on <a href="https://youtube.com/@officialmoondao">YouTube</a>.</em></p>
`;
}

// Create ConvertKit broadcast and send email
async function createConvertKitBroadcast(
  subject: string,
  content: string,
  tagId: string | undefined,
  apiKey: string
): Promise<ConvertKitBroadcast> {
  console.log("Creating ConvertKit broadcast...");
  const broadcastEndpoint = "https://api.convertkit.com/v4/broadcasts";

  const body = {
    subject: subject,
    content: content,
    public: true,
    send_at: null, // null means send immediately
  };

  const response = await fetch(broadcastEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ConvertKit API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { broadcast: ConvertKitBroadcast };
  const broadcast = data.broadcast;

  if (tagId && broadcast?.id) {
    await tagBroadcast(broadcast.id, tagId, apiKey);
  }

  console.log(`Broadcast created successfully: ${broadcast.id}`);
  return broadcast;
}

async function tagBroadcast(
  broadcastId: string,
  tagId: string,
  apiKey: string
): Promise<void> {
  const tagEndpoint = `https://api.convertkit.com/v4/broadcasts/${broadcastId}/tags`;

  await fetch(tagEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify({
      tag_id: tagId,
    }),
  });
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

      console.log(`Starting full pipeline for video: ${videoId}`);

      // Step 1: Extract audio URL
      const audioUrl = await extractAudioUrl(videoId);

      // Step 2: Transcribe
      const transcript = await transcribeAudio(audioUrl, whisperModel);

      if (!transcript || transcript.trim().length === 0) {
        return res
          .status(500)
          .json({ error: "Empty transcript received" } as any);
      }

      // Step 3: Summarize
      const summary = await summarizeTranscript(transcript, openaiModel);

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
          convertKitTagId,
          convertKitApiKey!
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
