import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type Groq from "groq-sdk";
import {
  TranscriptNotReadyError,
  getTranscript,
  summarizeTranscript,
} from "../utils/processing";
import { LLM_CONFIG } from "../utils/config";
import { json, mockFetch, quietConsole } from "./helpers";

let restoreConsole: () => void;
before(() => (restoreConsole = quietConsole()));
after(() => restoreConsole());

const VIDEO_ID = "m5nA2Bv6qa4";
const SAVED_ENV = { ...process.env };

beforeEach(() => {
  process.env.TRANSCRIPT_SOURCE = "auto";
  process.env.YOUTUBE_OAUTH_CLIENT_ID = "client";
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET = "secret";
  process.env.YOUTUBE_OAUTH_REFRESH_TOKEN = "refresh";
  // No yt-dlp on PATH: the audio fallback fails at once, without touching
  // the network, the way it fails on a GitHub runner.
  process.env.PATH = "/nonexistent";
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
});

const SRT = [
  "1",
  "00:00:00,000 --> 00:00:04,000",
  "welcome everyone to the Moondow town hall",
  "",
  "2",
  "00:00:04,000 --> 00:00:09,000",
  "today we have project updates and a guest speaker joining us from orbit",
  "",
  "3",
  "00:00:09,000 --> 00:00:14,000",
  "and then we will go through the new proposals that are up for a vote",
].join("\n");

type Tracks = Array<{ id: string; trackKind: string; language: string }>;

function youtube(options: {
  tokenError?: string;
  tracks?: Tracks;
  srt?: string;
}) {
  return mockFetch((url) => {
    if (url.hostname === "oauth2.googleapis.com") {
      return options.tokenError
        ? json({ error: options.tokenError, error_description: "Token expired" }, 400)
        : json({ access_token: "access" });
    }
    if (url.pathname === "/youtube/v3/captions") {
      return json({
        items: (options.tracks ?? []).map((t) => ({
          id: t.id,
          snippet: { trackKind: t.trackKind, language: t.language },
        })),
      });
    }
    if (url.pathname.startsWith("/youtube/v3/captions/")) {
      return new Response(options.srt ?? "");
    }
    // Anonymous timedtext path: blocked from datacenter IPs, so it finds nothing.
    return new Response("{}", { status: 200 });
  });
}

const noGroq = {} as Groq;

test("captions from the owner API are used and spelling-corrected", async () => {
  const api = youtube({
    tracks: [{ id: "t1", trackKind: "ASR", language: "en" }],
    srt: SRT,
  });
  try {
    const transcript = await getTranscript(VIDEO_ID, noGroq);
    assert.match(transcript, /^welcome everyone to the MoonDAO town hall/);
  } finally {
    api.restore();
  }
});

test("no caption tracks yet is reported as not ready", async () => {
  const api = youtube({ tracks: [] });
  try {
    await assert.rejects(getTranscript(VIDEO_ID, noGroq), (error: Error) => {
      assert.ok(error instanceof TranscriptNotReadyError);
      assert.match(error.message, /no usable caption track/);
      assert.match(error.message, /TRANSCRIPT_SOURCE=audio yarn retro m5nA2Bv6qa4/);
      return true;
    });
  } finally {
    api.restore();
  }
});

test("an empty ASR track is reported as not ready", async () => {
  // What m5nA2Bv6qa4 returned on 2026-10-16: the track existed, with no text.
  const api = youtube({
    tracks: [{ id: "t1", trackKind: "ASR", language: "en" }],
    srt: "",
  });
  try {
    await assert.rejects(
      getTranscript(VIDEO_ID, noGroq),
      (error: Error) => error instanceof TranscriptNotReadyError
    );
  } finally {
    api.restore();
  }
});

test("an expired OAuth token is reported as itself, not as missing captions", async () => {
  const api = youtube({ tokenError: "invalid_grant" });
  try {
    await assert.rejects(getTranscript(VIDEO_ID, noGroq), (error: Error) => {
      assert.ok(!(error instanceof TranscriptNotReadyError));
      assert.match(error.message, /invalid_grant/);
      assert.match(error.message, /yarn oauth:setup/);
      return true;
    });
  } finally {
    api.restore();
  }
});

type Reply = { content: string | null; finish_reason?: string };

function fakeGroq(replies: Reply[]) {
  const requests: any[] = [];
  const groq = {
    chat: {
      completions: {
        create: async (request: any) => {
          requests.push(request);
          const reply = replies[Math.min(requests.length - 1, replies.length - 1)];
          return {
            choices: [
              {
                message: { content: reply.content },
                finish_reason: reply.finish_reason ?? "stop",
              },
            ],
            usage: { completion_tokens: 1234 },
          };
        },
      },
    },
  } as unknown as Groq;
  return { groq, requests };
}

const noWait = { retryWaitSeconds: 0 };

test("an empty reply is retried", async () => {
  const { groq, requests } = fakeGroq([
    { content: "" },
    { content: "## Project Updates\n- Moondow shipped" },
  ]);
  const summary = await summarizeTranscript("transcript", groq, "model", noWait);
  assert.equal(summary, "## Project Updates\n- MoonDAO shipped");
  assert.equal(requests.length, 2);
});

test("a reply that keeps coming back empty fails with the reason", async () => {
  const { groq, requests } = fakeGroq([{ content: null, finish_reason: "length" }]);
  await assert.rejects(
    summarizeTranscript("transcript", groq, "model", noWait),
    /empty summary \(finish_reason=length, completion_tokens=1234/
  );
  assert.equal(requests.length, LLM_CONFIG.retry.maxRetries);
});

test("a truncated summary is retried rather than published", async () => {
  const { groq, requests } = fakeGroq([
    { content: "## Additional Information\n- Follow announcements (Ron", finish_reason: "length" },
    { content: "## Additional Information\n- Follow announcements (Ron Garan)." },
  ]);
  const summary = await summarizeTranscript("transcript", groq, "model", noWait);
  assert.match(summary, /\(Ron Garan\)\.$/);
  assert.equal(requests.length, 2);
});

test("the request leaves room for reasoning and the answer", async () => {
  const { groq, requests } = fakeGroq([{ content: "## Project Updates\n- ok" }]);
  await summarizeTranscript("transcript", groq, "model", noWait);
  assert.equal(requests[0].max_tokens, 8000);
});
