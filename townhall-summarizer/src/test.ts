#!/usr/bin/env node

/**
 * Test script for townhall-summarizer service
 *
 * Tests the full pipeline without sending ConvertKit emails.
 *
 * Usage:
 *   npm test <videoId>
 *   npm test dQw4w9WgXcQ
 *
 * Environment variables:
 *   SERVICE_URL - URL of the service (default: http://localhost:8080)
 *   OPENAI_API_KEY - Required for transcription and summarization
 */

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

const videoId = process.argv[2];

if (!videoId) {
  console.error("Error: Video ID is required");
  console.log("Usage: npm test <videoId>");
  console.log("Example: npm test dQw4w9WgXcQ");
  process.exit(1);
}

const serviceUrl = process.env.SERVICE_URL || "http://localhost:8080";

async function testPipeline(): Promise<void> {
  console.log("🧪 Testing Townhall Processing Pipeline\n");
  console.log(`Service URL: ${serviceUrl}`);
  console.log(`Video ID: ${videoId}\n`);

  try {
    console.log("📡 Calling /process endpoint with testMode=true...\n");

    const response = await fetch(`${serviceUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoId: videoId,
        videoTitle: "Test Town Hall",
        videoDate: new Date().toISOString(),
        openaiModel: process.env.OPENAI_MODEL || "gpt-4",
        whisperModel: process.env.WHISPER_MODEL || "whisper-1",
        testMode: true,
        // convertKitApiKey and convertKitTagId not required in test mode
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Request failed:", response.status, response.statusText);
      console.error("Error details:", errorText);
      process.exit(1);
    }

    const result = (await response.json()) as ProcessResponse;

    console.log("✅ Pipeline completed successfully!\n");
    console.log("=".repeat(80));
    console.log("RESULTS");
    console.log("=".repeat(80));
    console.log(`Video ID: ${result.videoId}`);
    console.log(`Broadcast ID: ${result.broadcastId || "N/A (test mode)"}`);
    console.log(`Test Mode: ${result.testMode}\n`);

    if (result.transcript) {
      console.log("=".repeat(80));
      console.log("TRANSCRIPT (first 500 chars)");
      console.log("=".repeat(80));
      console.log(result.transcript);
      console.log("\n");
    }

    if (result.fullSummary) {
      console.log("=".repeat(80));
      console.log("SUMMARY");
      console.log("=".repeat(80));
      console.log(result.fullSummary);
      console.log("\n");
    }

    if (result.formattedSummary) {
      console.log("=".repeat(80));
      console.log("FORMATTED SUMMARY (for ConvertKit)");
      console.log("=".repeat(80));
      console.log(result.formattedSummary);
      console.log("\n");
    }

    console.log("=".repeat(80));
    console.log("✅ Test completed successfully!");
    console.log("No ConvertKit email was sent (test mode).");
    console.log("=".repeat(80));
  } catch (error) {
    console.error(
      "\n❌ Test failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    if (error instanceof Error && "cause" in error) {
      console.error("Cause:", (error as any).cause);
    }
    process.exit(1);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === "undefined") {
  console.error(
    "Error: This script requires Node.js 18+ (for native fetch support)"
  );
  console.error("Alternatively, install node-fetch: npm install node-fetch");
  process.exit(1);
}

testPipeline();
