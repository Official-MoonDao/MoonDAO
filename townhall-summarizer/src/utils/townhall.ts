import { YouTubeVideoMetadata } from "./youtube";

/**
 * Decides which channel videos are town halls.
 *
 * The scheduled job used to summarize every video its YouTube search returned.
 * That was fine while the channel only held weekly streams. From late October
 * 2026 the channel also publishes several short clips a day, many titled
 * "… | MoonDAO Town Hall", and each one was summarized, published to
 * /townhall as a "Town Hall Summary", and able to fail the whole run.
 *
 * Titles cannot tell the two apart: clips carry the phrase and real streams
 * get renamed after the fact. Length can. Town halls run about an hour; the
 * clips are a few minutes at most.
 */

export const DEFAULT_MIN_DURATION_MINUTES = 20;
export const DEFAULT_CAPTION_GRACE_HOURS = 36;

export type Classification =
  | { kind: "townhall" }
  /** Not something this job should ever summarize. */
  | { kind: "not-townhall"; reason: string }
  /** Might be a town hall, but YouTube has not finished with it yet. */
  | { kind: "in-progress"; reason: string };

export interface ClassifyOptions {
  minDurationMinutes?: number;
  /** Video ids to leave alone no matter what they look like. */
  skipVideoIds?: ReadonlySet<string>;
  /**
   * True when the video came from the "completed live streams" search, which
   * is a second witness that it was streamed in case the video record lacks
   * `liveStreamingDetails`.
   */
  knownLiveStream?: boolean;
}

function positiveNumberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getMinDurationMinutes(): number {
  return positiveNumberFromEnv(
    "TOWNHALL_MIN_DURATION_MINUTES",
    DEFAULT_MIN_DURATION_MINUTES
  );
}

export function getCaptionGraceHours(): number {
  return positiveNumberFromEnv(
    "TOWNHALL_CAPTION_GRACE_HOURS",
    DEFAULT_CAPTION_GRACE_HOURS
  );
}

export function getSkipVideoIds(): Set<string> {
  return new Set(
    (process.env.TOWNHALL_SKIP_VIDEO_IDS || "")
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

export function classifyVideo(
  video: YouTubeVideoMetadata,
  options: ClassifyOptions = {}
): Classification {
  const minDurationMinutes =
    options.minDurationMinutes ?? DEFAULT_MIN_DURATION_MINUTES;

  if (options.skipVideoIds?.has(video.id)) {
    return {
      kind: "not-townhall",
      reason: "listed in TOWNHALL_SKIP_VIDEO_IDS",
    };
  }

  if (
    video.liveBroadcastContent === "live" ||
    video.liveBroadcastContent === "upcoming"
  ) {
    return {
      kind: "in-progress",
      reason: `stream is ${video.liveBroadcastContent}`,
    };
  }

  const wasLiveStream = Boolean(
    video.actualStartTime || options.knownLiveStream
  );

  if (!video.durationSeconds) {
    return wasLiveStream
      ? {
          kind: "in-progress",
          reason: "YouTube is still processing the stream recording",
        }
      : { kind: "not-townhall", reason: "no duration reported" };
  }

  if (video.durationSeconds < minDurationMinutes * 60) {
    return {
      kind: "not-townhall",
      reason: `${formatDuration(
        video.durationSeconds
      )} long (town halls run at least ${minDurationMinutes} minutes)`,
    };
  }

  if (!wasLiveStream && !/town\s*hall/i.test(video.title)) {
    return {
      kind: "not-townhall",
      reason: "an upload rather than a live stream, and not titled Town Hall",
    };
  }

  return { kind: "townhall" };
}

/**
 * When the town hall finished. `publishedAt` is not usable for this: YouTube
 * has been seen to report two different values for the same stream a week
 * apart, so the stream's own end time wins whenever it exists.
 */
export function getEndedAt(video: YouTubeVideoMetadata): Date | null {
  for (const candidate of [
    video.actualEndTime,
    video.actualStartTime,
    video.publishedAt,
  ]) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export function hoursSinceEnded(
  video: YouTubeVideoMetadata,
  now: Date = new Date()
): number | null {
  const endedAt = getEndedAt(video);
  if (!endedAt) return null;
  return (now.getTime() - endedAt.getTime()) / 3_600_000;
}
