import { exec } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";

const execAsync = promisify(exec);

export async function extractAudioUrl(videoId: string): Promise<string> {
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

export async function transcribeAudio(
  audioUrl: string,
  openai: OpenAI,
  model: string = "whisper-1"
): Promise<string> {
  console.log("Fetching audio for transcription...");
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
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

export function getTownHallSummaryPrompt(transcript: string): string {
  return `You are summarizing a MoonDAO Town Hall meeting transcript. MoonDAO Townhalls follow a structured format. Please organize your summary accordingly:

**Guest Speaker**
- Name and background of the guest
- Key topics discussed by the guest
- Important points from their presentation or conversation with the MoonDAO team
- Note: Sometimes there is no guest speaker

**Project Updates**
- List each active project and its current status
- Updates from project leaders
- Progress, milestones, or challenges mentioned
- Note: Sometimes there are no project updates or no active projects

**New Proposals**
- Any proposals being presented for upcoming votes
- Key details, rationale, and implications of each proposal
- Voting timelines if mentioned
- Budget if mentioned in ETH or ERC20(DIA, USDC, USDT, etc.), do not mention USD values
- Note: Sometimes there are no new proposals

**Additional Information**
- Any other important announcements, updates, or community news
- Action items or next steps for the community
- Important dates or deadlines
- Note: This section may not always be present

Format your response with clear section headers (use **bold** for headers). Use bullet points for lists. If a section is not present in the transcript, omit it entirely (don't write "No guest speaker" or "No updates"). Make it easy to scan and understand.

Transcript:
${transcript}

Please provide the summary now:`;
}

export async function summarizeTranscript(
  transcript: string,
  openai: OpenAI,
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

export function formatSummaryForConvertKit(
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

  const videoUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : "https://youtube.com/@officialmoondao";

  return `
${videoIdComment}
<h1>Town Hall Summary - ${formattedDate}</h1>
<h2>${videoTitle}</h2>

${summary}

<hr>

<p><em>This summary was automatically generated from the Town Hall transcript. Watch the full video on <a href="${videoUrl}">YouTube</a>.</em></p>
`;
}
