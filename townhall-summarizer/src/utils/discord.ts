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
