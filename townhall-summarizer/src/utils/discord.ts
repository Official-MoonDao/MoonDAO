/**
 * Discord webhook integration for town hall summary notifications.
 *
 * Sends a rich embed to a Discord channel via webhook after a new
 * town hall summary is created.
 */

export interface DiscordNotificationOptions {
  /** Title used in the summary (e.g. the video title) */
  videoTitle: string;
  /** ISO date string of the town hall */
  videoDate: string;
  /** YouTube video ID */
  videoId: string;
  /** First ~300 chars of the plain-text summary for the embed description */
  summaryPreview: string;
  /** ConvertKit broadcast public URL (if available) */
  broadcastUrl?: string;
}

/**
 * Sends a town hall summary notification to Discord via webhook.
 *
 * Uses @everyone so the whole community sees the new summary.
 * The embed links to both the /townhall page and the YouTube video.
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  options: DiscordNotificationOptions
): Promise<void> {
  const {
    videoTitle,
    videoDate,
    videoId,
    summaryPreview,
    broadcastUrl,
  } = options;

  const formattedDate = new Date(videoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const townhallPageUrl = "https://moondao.com/townhall";
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // Truncate the preview to a sensible length for Discord
  const truncatedPreview =
    summaryPreview.length > 300
      ? summaryPreview.substring(0, 297) + "..."
      : summaryPreview;

  const payload = {
    content: `@everyone 🚀 **New Town Hall Summary** — ${formattedDate}`,
    embeds: [
      {
        title: videoTitle,
        description: truncatedPreview,
        url: townhallPageUrl,
        color: 0xd85f2a, // MoonDAO orange
        thumbnail: {
          url: thumbnailUrl,
        },
        fields: [
          {
            name: "▶️ Watch on YouTube",
            value: `[Click here](${youtubeUrl})`,
            inline: true,
          },
          {
            name: "📄 Read Full Summary",
            value: `[moondao.com/townhall](${townhallPageUrl})`,
            inline: true,
          },
        ],
        footer: {
          text: "MoonDAO Town Hall Summarizer",
        },
        timestamp: new Date(videoDate).toISOString(),
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Discord webhook failed (${response.status}): ${body}`
    );
  }

  console.log("Discord notification sent successfully");
}

export interface DiscordErrorNotificationOptions {
  videoId: string;
  videoTitle?: string;
  videoDate?: string;
  error: string;
}

/**
 * Sends a failure alert to Discord so the team is notified when the
 * townhall pipeline crashes (cookies expired, GROQ down, etc.).
 *
 * Posts as a plain message (no @everyone) to a webhook channel.
 */
export async function sendDiscordErrorNotification(
  webhookUrl: string,
  options: DiscordErrorNotificationOptions
): Promise<void> {
  const { videoId, videoTitle, videoDate, error } = options;

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const truncatedError =
    error.length > 1500 ? error.substring(0, 1497) + "..." : error;

  const payload = {
    content: `⚠️ **Town Hall Summarizer failed** for [${
      videoTitle || videoId
    }](${youtubeUrl})`,
    embeds: [
      {
        title: "Pipeline Error",
        description: `\`\`\`\n${truncatedError}\n\`\`\``,
        color: 0xe53935, // red
        fields: [
          { name: "Video ID", value: videoId, inline: true },
          ...(videoDate
            ? [{ name: "Date", value: videoDate, inline: true }]
            : []),
        ],
        footer: { text: "MoonDAO Town Hall Summarizer" },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Discord error webhook failed (${response.status}): ${body}`
    );
  }
}

/**
 * Strip HTML tags from a string to produce plain text for the Discord preview.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
