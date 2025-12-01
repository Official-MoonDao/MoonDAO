import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { File } from "buffer";
import Groq from "groq-sdk";
import { rateLimiter } from "./rate-limiter";

const execAsync = promisify(exec);

// Rough token estimation: ~4 characters per token for English text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Get context window size based on model
function getContextWindow(model: string): number {
  // GROQ models with 128k context window
  if (
    model.includes("llama-3.3-70b") ||
    model.includes("llama-3.1-8b") ||
    model.includes("qwen") ||
    model.includes("kimi")
  ) {
    return 128000;
  }
  // GROQ models with 256k context window
  if (model.includes("kimi-k2")) {
    return 256000;
  }
  // Default to 128k for GROQ models
  return 128000;
}

// Check if transcript might exceed context window and warn
function checkTranscriptLength(
  transcript: string,
  contextWindow: number,
  reservedTokens: number
): void {
  const transcriptTokens = estimateTokens(transcript);
  const totalTokens = reservedTokens + transcriptTokens;
  const usagePercent = (totalTokens / contextWindow) * 100;

  if (totalTokens > contextWindow) {
    console.warn(
      `⚠️  WARNING: Transcript may exceed context window! Estimated tokens: ${totalTokens}/${contextWindow} (${usagePercent.toFixed(
        1
      )}%)`
    );
    console.warn(
      `   Consider using a model with a larger context window (e.g., llama-3.3-70b-versatile)`
    );
  } else if (usagePercent > 80) {
    console.warn(
      `⚠️  WARNING: Transcript is using ${usagePercent.toFixed(
        1
      )}% of context window (${totalTokens}/${contextWindow} tokens)`
    );
  }
}

// Split transcript into chunks that fit within TPM limit
function splitTranscriptIntoChunks(
  transcript: string,
  maxTokensPerRequest: number,
  reservedTokens: number
): string[] {
  const availableTokens = maxTokensPerRequest - reservedTokens;
  const maxCharsPerChunk = availableTokens * 4; // Rough conversion

  if (transcript.length <= maxCharsPerChunk) {
    return [transcript];
  }

  const chunks: string[] = [];
  let currentPos = 0;

  while (currentPos < transcript.length) {
    let chunkEnd = currentPos + maxCharsPerChunk;

    // Try to break at a sentence boundary (period, newline, or double newline)
    if (chunkEnd < transcript.length) {
      const nextPeriod = transcript.indexOf(".", chunkEnd - 500);
      const nextNewline = transcript.indexOf("\n", chunkEnd - 500);
      const nextDoubleNewline = transcript.indexOf("\n\n", chunkEnd - 500);

      if (
        nextDoubleNewline > currentPos &&
        nextDoubleNewline < chunkEnd + 500
      ) {
        chunkEnd = nextDoubleNewline + 2;
      } else if (nextNewline > currentPos && nextNewline < chunkEnd + 500) {
        chunkEnd = nextNewline + 1;
      } else if (nextPeriod > currentPos && nextPeriod < chunkEnd + 500) {
        chunkEnd = nextPeriod + 1;
      }
    }

    chunks.push(transcript.substring(currentPos, chunkEnd));
    currentPos = chunkEnd;
  }

  return chunks;
}

export async function extractAudioUrl(videoId: string): Promise<string> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`Extracting audio URL for video: ${videoId}`);

  try {
    const { stdout } = await execAsync(
      `yt-dlp -g -f "bestaudio/best" --no-warnings "${videoUrl}"`
    );

    const audioUrl = stdout.trim().split("\n")[0];
    if (!audioUrl) {
      throw new Error("Failed to extract audio URL - empty response");
    }

    console.log(`Successfully extracted audio URL for video: ${videoId}`);
    return audioUrl;
  } catch (error: any) {
    console.error(`yt-dlp error: ${error.message}`);
    throw new Error(`Failed to extract audio URL: ${error.message}`);
  }
}

export async function transcribeAudio(
  videoId: string,
  groq: Groq,
  model: string = "whisper-large-v3"
): Promise<string> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const timestamp = Date.now();
  const tempFile = join(tmpdir(), `audio-${videoId}-${timestamp}.m4a`);
  const compressedFile = join(
    tmpdir(),
    `audio-${videoId}-${timestamp}-compressed.mp3`
  );

  try {
    console.log("Downloading audio with yt-dlp...");
    console.log("This may take a few minutes for long videos...");

    await execAsync(
      `yt-dlp -f "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio" -o "${tempFile}" --no-warnings "${videoUrl}"`
    );

    // Check file size and compress if needed
    const audioBuffer = await readFile(tempFile);
    const sizeMB = audioBuffer.length / (1024 * 1024);
    const maxSizeMB = 24; // Keep under 25 MB limit with some buffer

    // Get actual duration of the audio file
    console.log("Getting audio duration...");
    const { stdout: durationOutput } = await execAsync(
      `ffprobe -i "${tempFile}" -show_entries format=duration -v quiet -of csv="p=0"`
    );
    const durationSeconds = parseFloat(durationOutput.trim()) || 3600; // Fallback to 1 hour if can't get duration
    console.log(`Audio duration: ${Math.floor(durationSeconds / 60)} minutes`);

    // Check rate limits before transcription
    await rateLimiter.checkAndWaitWhisper(Math.ceil(durationSeconds));

    if (sizeMB > maxSizeMB) {
      console.log(
        `Audio file is ${sizeMB.toFixed(
          2
        )} MB, compressing to under ${maxSizeMB} MB...`
      );

      // Calculate required bitrate to get under 24 MB
      // Formula: bitrate (kbps) = (target_size_MB * 8 * 1024) / duration_seconds
      const targetSizeMB = 20; // Target 20 MB for safety buffer
      const requiredBitrate = Math.floor(
        (targetSizeMB * 8 * 1024) / durationSeconds
      );
      // Use a bitrate between 32-96 kbps (32 is minimum for decent quality, 96 is reasonable for speech)
      const bitrate = Math.max(32, Math.min(96, requiredBitrate));

      console.log(
        `Using bitrate: ${bitrate} kbps to target ~${targetSizeMB} MB`
      );

      await execAsync(
        `ffmpeg -i "${tempFile}" -codec:a libmp3lame -b:a ${bitrate}k -ar 16000 -ac 1 "${compressedFile}" -y`
      );

      // Check if compression was successful and re-compress with lower bitrate if needed
      const compressedBuffer = await readFile(compressedFile);
      const compressedSizeMB = compressedBuffer.length / (1024 * 1024);

      if (compressedSizeMB > maxSizeMB) {
        console.log(
          `Compressed file is still ${compressedSizeMB.toFixed(
            2
          )} MB, re-compressing with lower bitrate...`
        );
        // Use even lower bitrate - target 18 MB
        const lowerTargetSizeMB = 18;
        const lowerBitrate = Math.max(
          32,
          Math.floor((lowerTargetSizeMB * 8 * 1024) / durationSeconds)
        );
        console.log(`Using lower bitrate: ${lowerBitrate} kbps`);

        await execAsync(
          `ffmpeg -i "${tempFile}" -codec:a libmp3lame -b:a ${lowerBitrate}k -ar 16000 -ac 1 "${compressedFile}" -y`
        );
      }

      // Clean up original file
      try {
        await unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    } else {
      // File is small enough, just convert to MP3 format
      console.log(
        `Audio file is ${sizeMB.toFixed(2)} MB, converting to MP3...`
      );
      await execAsync(
        `ffmpeg -i "${tempFile}" -codec:a libmp3lame -b:a 64k -ar 16000 -ac 1 "${compressedFile}" -y`
      );

      // Clean up original file
      try {
        await unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    console.log("Reading compressed audio file...");
    const finalBuffer = await readFile(compressedFile);
    const finalSizeMB = finalBuffer.length / (1024 * 1024);
    const finalSizeMBFormatted = finalSizeMB.toFixed(2);

    if (finalSizeMB > 25) {
      throw new Error(
        `Compressed audio file is still too large (${finalSizeMBFormatted} MB). Maximum allowed is 25 MB.`
      );
    }

    console.log(
      `Compressed audio ready (${finalSizeMBFormatted} MB). Starting transcription...`
    );

    // Create File object for GROQ API
    const audioFile = new File([finalBuffer], "audio.mp3", {
      type: "audio/mpeg",
    });

    console.log("Transcribing audio with GROQ Whisper...");
    const startTime = Date.now();

    // Retry logic for transcription
    let transcription: string | undefined;
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await groq.audio.transcriptions.create({
          file: audioFile,
          model: model,
          response_format: "text",
        });
        // When response_format is "text", GROQ returns a string
        transcription = response as unknown as string;
        // Record successful transcription for rate limiting
        rateLimiter.recordWhisperRequest(Math.ceil(durationSeconds));
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;

        // Check if it's a rate limit error from GROQ
        const errorMessage = error.message || error.toString();
        const rateLimitMatch = errorMessage.match(
          /Please try again in ([\d.]+)s/
        );

        if (rateLimitMatch && attempt < maxRetries) {
          const waitSeconds = Math.ceil(parseFloat(rateLimitMatch[1]));
          console.log(
            `⚠️  Rate limit exceeded. GROQ says to wait ${waitSeconds} seconds. Waiting...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, waitSeconds * 1000)
          );
          continue; // Retry after waiting
        }

        if (attempt < maxRetries) {
          const waitTime = attempt * 5; // Exponential backoff: 5s, 10s, 15s
          console.log(
            `⚠️  Transcription attempt ${attempt} failed (${error.message}). Retrying in ${waitTime} seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
        } else {
          console.error(`❌ Transcription failed after ${maxRetries} attempts`);

          // Provide helpful error message for rate limits
          if (
            errorMessage.includes("rate_limit") ||
            errorMessage.includes("Rate limit")
          ) {
            throw new Error(
              `GROQ rate limit exceeded. ${errorMessage}. Consider upgrading to Dev Tier or waiting before retrying.`
            );
          }

          throw error;
        }
      }
    }

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    console.log(
      `✅ Transcription completed in ${Math.floor(
        elapsedSeconds / 60
      )} minutes ${elapsedSeconds % 60} seconds`
    );

    if (!transcription) {
      throw new Error("No transcription generated");
    }

    console.log(`Transcription complete (${transcription.length} characters)`);

    // Clean up compressed file
    try {
      await unlink(compressedFile);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return transcription;
  } catch (error: any) {
    // Clean up temp files on error
    try {
      await unlink(tempFile).catch(() => {});
      await unlink(compressedFile).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }

    if (
      error.message?.includes("yt-dlp") ||
      error.message?.includes("ffmpeg")
    ) {
      throw new Error(`Failed to process audio: ${error.message}`);
    }
    throw error;
  }
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

// Helper function to retry GROQ API calls
async function retryGroqCall<T>(
  apiCall: () => Promise<T>,
  operation: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        const waitTime = attempt * 2; // Exponential backoff: 2s, 4s, 6s
        console.log(
          `⚠️  ${operation} attempt ${attempt} failed (${error.message}). Retrying in ${waitTime} seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
      } else {
        console.error(`❌ ${operation} failed after ${maxRetries} attempts`);
        throw error;
      }
    }
  }

  throw lastError;
}

export async function summarizeTranscript(
  transcript: string,
  groq: Groq,
  model: string = "llama-3.3-70b-versatile"
): Promise<string> {
  console.log("Generating summary with GROQ...");

  // Get context window for the model
  const contextWindow = getContextWindow(model);
  const systemMessage =
    "You are a helpful assistant that summarizes Town Hall meetings for the MoonDAO community. Provide clear, structured summaries with actionable information.";

  // Estimate tokens for system message and prompt template (without transcript)
  const promptTemplate = getTownHallSummaryPrompt("");
  const systemTokens = estimateTokens(systemMessage);
  const promptTemplateTokens = estimateTokens(promptTemplate);
  const reservedTokens = systemTokens + promptTemplateTokens + 2000; // 2000 for output max_tokens

  // Check transcript length and warn if approaching limits (but don't truncate)
  checkTranscriptLength(transcript, contextWindow, reservedTokens);

  const transcriptTokens = estimateTokens(transcript);
  const totalTokens = systemTokens + promptTemplateTokens + transcriptTokens;

  console.log(
    `Token usage: System=${systemTokens}, Prompt template=${promptTemplateTokens}, Transcript=${transcriptTokens}, Total=${totalTokens}/${contextWindow}`
  );

  // Check if we need chunking based on context window
  // With dev tier, TPM limits are much higher, so we only chunk based on context window
  // Only chunk if transcript exceeds the context window (128K tokens)
  const useChunking = totalTokens > contextWindow;

  if (useChunking) {
    console.log(
      `⚠️  Transcript exceeds context window (${totalTokens} > ${contextWindow}). Splitting into chunks...`
    );

    // Split transcript into chunks that fit within the context window
    // Account for reserved tokens (system + prompt template + output)
    const chunks = splitTranscriptIntoChunks(
      transcript,
      contextWindow,
      reservedTokens
    );
    console.log(`Processing ${chunks.length} chunks sequentially...`);

    const chunkSummaries: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Summarizing chunk ${i + 1}/${chunks.length}...`);
      const chunk = chunks[i];
      const chunkPrompt = getTownHallSummaryPrompt(chunk);

      // Add delay between requests to avoid rate limits
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
      }

      const chunkTokens = estimateTokens(chunkPrompt) + systemTokens + 2000;
      await rateLimiter.checkAndWaitLLM(chunkTokens);

      const response = await retryGroqCall(
        () =>
          groq.chat.completions.create({
            model: model,
            messages: [
              {
                role: "system",
                content: systemMessage,
              },
              {
                role: "user",
                content: chunkPrompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        `Chunk ${i + 1}/${chunks.length} summarization`
      );

      const chunkSummary = response.choices[0]?.message?.content;
      if (!chunkSummary) {
        throw new Error(`No summary generated for chunk ${i + 1}`);
      }

      // Record token usage for rate limiting
      const responseTokens = estimateTokens(chunkSummary);
      rateLimiter.recordLLMRequest(chunkTokens + responseTokens);

      chunkSummaries.push(chunkSummary);
      console.log(`✅ Chunk ${i + 1}/${chunks.length} summarized`);
    }

    // Always consolidate chunk summaries into a single, unified summary
    console.log("Consolidating chunk summaries into final summary...");
    const combinedSummary = chunkSummaries.join("\n\n");

    // Create a final consolidated summary from all chunk summaries
    console.log("Creating final consolidated summary...");
    const finalPrompt = `You are consolidating multiple summaries from a MoonDAO Town Hall meeting. These summaries were created by splitting a long transcript into chunks. Please merge them into a single, well-organized summary following the same format. Remove any duplicate information and ensure the summary flows naturally:

**Guest Speaker**
- Name and background of the guest
- Key topics discussed by the guest
- Important points from their presentation or conversation with the MoonDAO team

**Project Updates**
- List each active project and its current status
- Updates from project leaders
- Progress, milestones, or challenges mentioned

**New Proposals**
- Any proposals being presented for upcoming votes
- Key details, rationale, and implications of each proposal
- Voting timelines if mentioned
- Budget if mentioned in ETH or ERC20(DIA, USDC, USDT, etc.), do not mention USD values

**Additional Information**
- Any other important announcements, updates, or community news
- Action items or next steps for the community
- Important dates or deadlines

Format your response with clear section headers (use **bold** for headers). Use bullet points for lists. If a section is not present, omit it entirely.

Summaries to consolidate:
${combinedSummary}

Please provide the consolidated summary now:`;

    const finalPromptTokens = estimateTokens(finalPrompt) + systemTokens + 2000;
    await rateLimiter.checkAndWaitLLM(finalPromptTokens);

    const finalResponse = await retryGroqCall(
      () =>
        groq.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: systemMessage,
            },
            {
              role: "user",
              content: finalPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      "Final summary consolidation"
    );

    const finalSummary = finalResponse.choices[0]?.message?.content;
    if (!finalSummary) {
      throw new Error("No final summary generated");
    }

    // Record token usage for rate limiting
    const finalResponseTokens = estimateTokens(finalSummary);
    rateLimiter.recordLLMRequest(finalPromptTokens + finalResponseTokens);

    console.log("Summary generated successfully");
    return finalSummary;
  } else {
    // Single request - no chunking needed
    const prompt = getTownHallSummaryPrompt(transcript);

    const response = await retryGroqCall(
      () =>
        groq.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: systemMessage,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      "Summary generation"
    );

    const summary = response.choices[0]?.message?.content;
    if (!summary) {
      throw new Error("No summary generated from GROQ");
    }

    // Record token usage for rate limiting
    const responseTokens = estimateTokens(summary);
    rateLimiter.recordLLMRequest(totalTokens + responseTokens);

    console.log("Summary generated successfully");
    return summary;
  }
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
