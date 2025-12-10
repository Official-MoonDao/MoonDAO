import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { File } from "buffer";
import Groq from "groq-sdk";
import { rateLimiter } from "./rate-limiter";
import {
  SPELLING_CORRECTIONS,
  DEFAULT_MODELS,
  AUDIO_CONFIG,
  LLM_CONFIG,
  TOKEN_CONFIG,
  CONTEXT_WINDOWS,
  CONTEXT_WINDOW_MODELS,
  SYSTEM_MESSAGES,
  PROMPT_TEMPLATES,
} from "./config";

const execAsync = promisify(exec);

export function correctSpellings(text: string): string {
  let corrected = text;

  for (const { pattern, replacement } of SPELLING_CORRECTIONS) {
    corrected = corrected.replace(pattern, replacement);
  }

  return corrected;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / TOKEN_CONFIG.charsPerToken);
}

function getContextWindow(model: string): number {
  for (const modelPattern of CONTEXT_WINDOW_MODELS["256k"]) {
    if (model.includes(modelPattern)) {
      return CONTEXT_WINDOWS["256k"];
    }
  }

  for (const modelPattern of CONTEXT_WINDOW_MODELS["128k"]) {
    if (model.includes(modelPattern)) {
      return CONTEXT_WINDOWS["128k"];
    }
  }

  return CONTEXT_WINDOWS["128k"];
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
  } else if (usagePercent > TOKEN_CONFIG.contextWindowWarningThreshold) {
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
  const maxCharsPerChunk = availableTokens * TOKEN_CONFIG.charsPerToken;

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
  model: string = DEFAULT_MODELS.whisper
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

    // Get actual duration of the audio file
    console.log("Getting audio duration...");
    const { stdout: durationOutput } = await execAsync(
      `ffprobe -i "${tempFile}" -show_entries format=duration -v quiet -of csv="p=0"`
    );
    const durationSeconds =
      parseFloat(durationOutput.trim()) || AUDIO_CONFIG.fallbackDurationSeconds;
    console.log(`Audio duration: ${Math.floor(durationSeconds / 60)} minutes`);

    // Check rate limits before transcription
    await rateLimiter.checkAndWaitWhisper(Math.ceil(durationSeconds));

    if (sizeMB > AUDIO_CONFIG.maxSizeMB) {
      console.log(
        `Audio file is ${sizeMB.toFixed(2)} MB, compressing to under ${
          AUDIO_CONFIG.maxSizeMB
        } MB...`
      );

      const requiredBitrate = Math.floor(
        (AUDIO_CONFIG.targetSizeMB * 8 * 1024) / durationSeconds
      );
      const bitrate = Math.max(
        AUDIO_CONFIG.minBitrate,
        Math.min(AUDIO_CONFIG.maxBitrate, requiredBitrate)
      );

      console.log(
        `Using bitrate: ${bitrate} kbps to target ~${AUDIO_CONFIG.targetSizeMB} MB`
      );

      await execAsync(
        `ffmpeg -i "${tempFile}" -codec:a libmp3lame -b:a ${bitrate}k -ar ${AUDIO_CONFIG.sampleRate} -ac ${AUDIO_CONFIG.channels} "${compressedFile}" -y`
      );

      // Check if compression was successful and re-compress with lower bitrate if needed
      const compressedBuffer = await readFile(compressedFile);
      const compressedSizeMB = compressedBuffer.length / (1024 * 1024);

      if (compressedSizeMB > AUDIO_CONFIG.maxSizeMB) {
        console.log(
          `Compressed file is still ${compressedSizeMB.toFixed(
            2
          )} MB, re-compressing with lower bitrate...`
        );
        const lowerBitrate = Math.max(
          AUDIO_CONFIG.minBitrate,
          Math.floor(
            (AUDIO_CONFIG.lowerTargetSizeMB * 8 * 1024) / durationSeconds
          )
        );
        console.log(`Using lower bitrate: ${lowerBitrate} kbps`);

        await execAsync(
          `ffmpeg -i "${tempFile}" -codec:a libmp3lame -b:a ${lowerBitrate}k -ar ${AUDIO_CONFIG.sampleRate} -ac ${AUDIO_CONFIG.channels} "${compressedFile}" -y`
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
        `ffmpeg -i "${tempFile}" -codec:a libmp3lame -b:a 64k -ar ${AUDIO_CONFIG.sampleRate} -ac ${AUDIO_CONFIG.channels} "${compressedFile}" -y`
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

    if (finalSizeMB > AUDIO_CONFIG.maxAllowedSizeMB) {
      throw new Error(
        `Compressed audio file is still too large (${finalSizeMBFormatted} MB). Maximum allowed is ${AUDIO_CONFIG.maxAllowedSizeMB} MB.`
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

    for (let attempt = 1; attempt <= LLM_CONFIG.retry.maxRetries; attempt++) {
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
        console.error(`Full error object:`, {
          message: error.message,
          code: error.code,
          cause: error.cause,
          stack: error.stack,
        });

        // Check if it's a rate limit error from GROQ
        const errorMessage = error.message || error.toString();
        const rateLimitMatch = errorMessage.match(
          /Please try again in ([\d.]+)s/
        );

        if (rateLimitMatch && attempt < LLM_CONFIG.retry.maxRetries) {
          const waitSeconds = Math.ceil(parseFloat(rateLimitMatch[1]));
          console.log(
            `⚠️  Rate limit exceeded. GROQ says to wait ${waitSeconds} seconds. Waiting...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, waitSeconds * 1000)
          );
          continue; // Retry after waiting
        }

        if (attempt < LLM_CONFIG.retry.maxRetries) {
          const waitTime =
            attempt * LLM_CONFIG.retry.transcriptionWaitTimeSeconds;
          console.log(
            `⚠️  Transcription attempt ${attempt} failed (${error.message}). Retrying in ${waitTime} seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
        } else {
          console.error(
            `❌ Transcription failed after ${LLM_CONFIG.retry.maxRetries} attempts`
          );

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

    transcription = correctSpellings(transcription);

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
  return PROMPT_TEMPLATES.summary.replace("{transcript}", transcript);
}

async function retryGroqCall<T>(
  apiCall: () => Promise<T>,
  operation: string,
  maxRetries: number = LLM_CONFIG.retry.maxRetries
): Promise<T> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        const waitTime = attempt * LLM_CONFIG.retry.baseWaitTimeSeconds;
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
  model: string = DEFAULT_MODELS.llm
): Promise<string> {
  console.log("Generating summary with GROQ...");

  const contextWindow = getContextWindow(model);
  const systemMessage = SYSTEM_MESSAGES.summarizer;

  const promptTemplate = getTownHallSummaryPrompt("");
  const systemTokens = estimateTokens(systemMessage);
  const promptTemplateTokens = estimateTokens(promptTemplate);
  const reservedTokens =
    systemTokens + promptTemplateTokens + TOKEN_CONFIG.reservedTokensBuffer;

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
        await new Promise((resolve) =>
          setTimeout(resolve, LLM_CONFIG.chunkDelayMs)
        );
      }

      const chunkTokens =
        estimateTokens(chunkPrompt) +
        systemTokens +
        TOKEN_CONFIG.reservedTokensBuffer;
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
            temperature: LLM_CONFIG.temperature,
            max_tokens: LLM_CONFIG.maxTokens,
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

      // Correct common misspellings in chunk summary
      const correctedChunkSummary = correctSpellings(chunkSummary);
      chunkSummaries.push(correctedChunkSummary);
      console.log(`✅ Chunk ${i + 1}/${chunks.length} summarized`);
    }

    // Always consolidate chunk summaries into a single, unified summary
    console.log("Consolidating chunk summaries into final summary...");
    const combinedSummary = chunkSummaries.join("\n\n");

    // Create a final consolidated summary from all chunk summaries
    console.log("Creating final consolidated summary...");
    const finalPrompt = PROMPT_TEMPLATES.consolidation.replace(
      "{summaries}",
      combinedSummary
    );

    const finalPromptTokens =
      estimateTokens(finalPrompt) +
      systemTokens +
      TOKEN_CONFIG.reservedTokensBuffer;
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

    const correctedSummary = correctSpellings(finalSummary);

    console.log("Summary generated successfully");
    return correctedSummary;
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

    const correctedSummary = correctSpellings(summary);

    console.log("Summary generated successfully");
    return correctedSummary;
  }
}

export function formatSummaryForConvertKit(
  summary: string,
  videoTitle: string,
  videoDate: string,
  videoId?: string
): string {
  const videoIdComment = videoId ? `<!-- TOWNHALL_VIDEO_ID:${videoId} -->` : "";
  const videoDateComment = `<!-- TOWNHALL_VIDEO_DATE:${videoDate} -->`;

  const videoUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : "https://youtube.com/@officialmoondao";

  // Convert markdown to HTML for ConvertKit
  const { marked } = require("marked");

  // Configure marked for ConvertKit compatibility
  marked.setOptions({
    breaks: true, // Convert \n to <br>
    gfm: true, // GitHub Flavored Markdown
  });

  // Convert the markdown summary to HTML (use parseInline for synchronous parsing)
  // marked.parse() is synchronous in v17, but returns string
  let htmlSummary: string;
  try {
    htmlSummary = marked.parse(summary) as string;
  } catch (error) {
    // Fallback: if parsing fails, just use the original summary
    console.warn("Failed to parse markdown, using original summary:", error);
    htmlSummary = summary;
  }

  return `
${videoIdComment}
${videoDateComment}
<h1>Town Hall Summary</h1>
<h2>${videoTitle}</h2>

${htmlSummary}

<hr>

<p><em>This summary was automatically generated from the Town Hall transcript. Watch the full video on <a href="${videoUrl}" target="_blank" rel="noopener noreferrer">YouTube</a>.</em></p>
`;
}
