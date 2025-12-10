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
 *   GROQ_API_KEY - Required for transcription and summarization
 */

import "dotenv/config";
import { Agent } from "undici";

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

async function waitForService(maxAttempts = 30): Promise<void> {
  console.log("⏳ Waiting for service to be ready...");
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${serviceUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        console.log("✅ Service is ready!\n");
        return;
      }
    } catch (error) {
      // Service not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    process.stdout.write(".");
  }
  console.log("\n");
  throw new Error("Service did not become ready in time");
}

async function testPipeline(): Promise<void> {
  console.log("🧪 Testing Townhall Processing Pipeline\n");
  console.log(`Service URL: ${serviceUrl}`);
  console.log(`Video ID: ${videoId}\n`);

  try {
    await waitForService();
    console.log("📡 Calling /process endpoint with testMode=true...\n");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200000); // 20 minute timeout

    // Configure fetch with longer timeout for long-running requests
    // Node.js fetch uses undici which has default headers timeout of 30s
    // We need to increase this for long-running operations
    const dispatcher = new Agent({
      connect: { timeout: 600000 }, // 10 minutes connection timeout
      headersTimeout: 1200000, // 20 minutes headers timeout
      bodyTimeout: 1200000, // 20 minutes body timeout
    });

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoId: videoId,
        videoTitle: "Test Town Hall",
        videoDate: new Date().toISOString(),
        groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        whisperModel: process.env.WHISPER_MODEL || "whisper-large-v3",
        testMode: true,
        // convertKitApiKey and convertKitTagId not required in test mode
      }),
      signal: controller.signal,
      // @ts-ignore - undici dispatcher option
      dispatcher: dispatcher,
    };

    const response = await fetch(`${serviceUrl}/process`, fetchOptions);

    clearTimeout(timeoutId);

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
