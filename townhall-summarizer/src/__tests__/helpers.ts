import { YouTubeVideoMetadata } from "../utils/youtube";

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/** Replaces global fetch for one test. Returns the calls made and a restore. */
export function mockFetch(handler: Handler): {
  calls: URL[];
  restore: () => void;
} {
  const original = globalThis.fetch;
  const calls: URL[] = [];

  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? String(input));
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;

  return { calls, restore: () => (globalThis.fetch = original) };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function video(
  overrides: Partial<YouTubeVideoMetadata> & { id: string }
): YouTubeVideoMetadata {
  return {
    title: "MoonDAO Town Hall | Network & Ecosystem Updates",
    description: "",
    thumbnail: "",
    publishedAt: "2026-11-20T09:20:01Z",
    duration: "PT1H2M",
    channelId: "UC_moondao",
    channelTitle: "MoonDAO",
    liveBroadcastContent: "none",
    durationSeconds: 3720,
    actualStartTime: "2026-11-19T20:00:00Z",
    actualEndTime: "2026-11-19T21:02:00Z",
    ...overrides,
  };
}

/** Silences console output for the duration of a test file. */
export function quietConsole(): () => void {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  return () => Object.assign(console, original);
}
