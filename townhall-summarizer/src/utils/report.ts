import { appendFileSync, writeFileSync } from "fs";

/**
 * Turns the outcome of a run into something a person can act on.
 *
 * The workflow's failure alert used to be one fixed sentence — "no new summary
 * was published this week" — sent whenever the step exited non-zero. In the
 * four weeks before this was written that sentence was false every time: the
 * town hall had been summarized and the run was red because of unrelated
 * clips. The alert now says which video failed, why, and what to do about it.
 */

export type VideoStatus =
  /** A new summary was published. */
  | "created"
  /** A summary already existed; nothing to do. */
  | "already-processed"
  /** Captions are not ready yet; the next scheduled run will try again. */
  | "pending"
  | "failed";

export interface ProcessResult {
  videoInput: string;
  videoId?: string;
  title?: string;
  status: VideoStatus;
  error?: string;
  broadcastId?: string;
  /** Hours since the stream ended, when YouTube reports it. */
  hoursSinceEnded?: number;
}

const DISCORD_CONTENT_LIMIT = 1800;

// Angle brackets stop Discord from unfurling every link into a video embed.
function label(result: ProcessResult): string {
  const id = result.videoId ?? result.videoInput;
  const url = `<https://youtu.be/${id}>`;
  return result.title ? `"${result.title}" ${url}` : url;
}

function age(result: ProcessResult): string {
  return result.hoursSinceEnded === undefined
    ? ""
    : `, ended ${Math.round(result.hoursSinceEnded)}h ago`;
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

/** True when a person needs to do something. */
export function runFailed(results: ProcessResult[]): boolean {
  return results.some((r) => r.status === "failed");
}

/**
 * The Discord message for a run that needs attention, or null when it does
 * not. Plain text; the workflow adds the link to the logs.
 */
export function formatAlert(results: ProcessResult[]): string | null {
  const failed = results.filter((r) => r.status === "failed");
  if (failed.length === 0) return null;

  const created = results.filter((r) => r.status === "created");
  const lines = [
    failed.length === 1
      ? "Town hall summarizer: 1 town hall could not be summarized."
      : `Town hall summarizer: ${failed.length} town halls could not be summarized.`,
  ];

  for (const result of failed) {
    lines.push(
      `- ${label(result)}${age(result)}: ${truncate(
        result.error ?? "unknown error",
        500
      )}`
    );
  }

  if (created.length > 0) {
    lines.push(
      `Published in the same run: ${created.map((r) => label(r)).join(", ")}.`
    );
  }

  lines.push("The job runs daily and will try again on its next run.");

  return truncate(lines.join("\n"), DISCORD_CONTENT_LIMIT);
}

/** The Discord message for a run that died before it processed anything. */
export function formatCrashAlert(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return truncate(
    `Town hall summarizer could not check for new town halls: ${message}\n` +
      "The job runs daily and will try again on its next run.",
    DISCORD_CONTENT_LIMIT
  );
}

export function formatReport(results: ProcessResult[]): string {
  const sections: Array<[VideoStatus, string]> = [
    ["created", "Published"],
    ["pending", "Waiting for YouTube captions (will retry on the next run)"],
    ["failed", "Failed"],
    ["already-processed", "Already summarized"],
  ];

  const lines: string[] = [];
  for (const [status, heading] of sections) {
    const matching = results.filter((r) => r.status === status);
    if (matching.length === 0) continue;
    lines.push(`${heading}: ${matching.length}`);
    for (const result of matching) {
      const detail =
        status === "created" || status === "already-processed"
          ? result.broadcastId
            ? ` — broadcast ${result.broadcastId}`
            : ""
          : `${age(result)} — ${result.error ?? "unknown error"}`;
      lines.push(`- ${label(result)}${detail}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "Nothing to do.";
}

/**
 * Writes the alert text where the workflow's failure step picks it up, and the
 * report to the run's summary page. Both are no-ops outside GitHub Actions.
 */
export function publishAlert(alert: string | null): void {
  const alertFile = process.env.TOWNHALL_ALERT_FILE;
  if (!alertFile || !alert) return;
  try {
    writeFileSync(alertFile, alert);
  } catch (error) {
    console.warn(`Could not write alert file ${alertFile}:`, error);
  }
}

export function publishStepSummary(markdown: string): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  try {
    appendFileSync(summaryFile, `${markdown}\n`);
  } catch (error) {
    console.warn(`Could not write step summary:`, error);
  }
}
