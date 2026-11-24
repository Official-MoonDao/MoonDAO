export interface YouTubeVideoMetadata {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  channelId: string;
  channelTitle: string;
  liveBroadcastContent?: string;
  /** Length of the video, or null while YouTube has not reported one yet. */
  durationSeconds: number | null;
  /** Set only for videos that were streamed live. */
  actualStartTime?: string;
  actualEndTime?: string;
}

interface YouTubeVideoResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: {
        maxres?: { url?: string };
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
      publishedAt?: string;
      channelId?: string;
      channelTitle?: string;
      liveBroadcastContent?: string;
    };
    contentDetails?: {
      duration?: string;
    };
    status?: {
      liveBroadcastContent?: string;
    };
    liveStreamingDetails?: {
      actualStartTime?: string;
      actualEndTime?: string;
    };
  }>;
}

interface YouTubeChannelResponse {
  items?: Array<{
    id?: string;
  }>;
}

export function extractVideoId(urlOrId: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Parses the ISO 8601 duration the Data API returns (`PT1H2M3S`, `P1DT2H`).
 * Returns null for anything unparseable. A stream that is still live or still
 * being processed reports `P0D`, which parses to 0.
 */
export function parseIsoDurationSeconds(
  iso: string | undefined | null
): number | null {
  if (!iso) return null;
  const match = iso.match(
    /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  );
  if (!match) return null;
  const [, weeks, days, hours, minutes, seconds] = match;
  return Math.round(
    Number(weeks || 0) * 604800 +
      Number(days || 0) * 86400 +
      Number(hours || 0) * 3600 +
      Number(minutes || 0) * 60 +
      Number(seconds || 0)
  );
}

const VIDEOS_PER_REQUEST = 50;

/**
 * Looks up several videos at once (one quota unit per 50 ids). Ids the API
 * does not return — deleted or private videos — are absent from the map.
 */
export async function getVideosMetadata(
  videoIds: string[],
  apiKey: string
): Promise<Map<string, YouTubeVideoMetadata>> {
  const result = new Map<string, YouTubeVideoMetadata>();
  const unique = [...new Set(videoIds)];

  for (let i = 0; i < unique.length; i += VIDEOS_PER_REQUEST) {
    const batch = unique.slice(i, i + VIDEOS_PER_REQUEST);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set(
      "part",
      "snippet,contentDetails,status,liveStreamingDetails"
    );
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = (await response.json()) as YouTubeVideoResponse;

    for (const video of data.items || []) {
      const snippet = video.snippet;
      if (!video.id || !snippet) continue;

      result.set(video.id, {
        id: video.id,
        title: snippet.title || "",
        description: snippet.description || "",
        thumbnail:
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          "",
        publishedAt: snippet.publishedAt || "",
        duration: video.contentDetails?.duration || "",
        channelId: snippet.channelId || "",
        channelTitle: snippet.channelTitle || "",
        liveBroadcastContent:
          snippet.liveBroadcastContent || video.status?.liveBroadcastContent,
        durationSeconds: parseIsoDurationSeconds(video.contentDetails?.duration),
        actualStartTime: video.liveStreamingDetails?.actualStartTime,
        actualEndTime: video.liveStreamingDetails?.actualEndTime,
      });
    }
  }

  return result;
}

export async function getVideoMetadata(
  videoId: string,
  apiKey: string
): Promise<YouTubeVideoMetadata | null> {
  try {
    const videos = await getVideosMetadata([videoId], apiKey);
    return videos.get(videoId) ?? null;
  } catch (error) {
    console.error("Error fetching video metadata:", error);
    throw error;
  }
}

export async function validateVideoChannel(
  videoMetadata: YouTubeVideoMetadata,
  allowedChannelId: string
): Promise<boolean> {
  if (!allowedChannelId) {
    return true;
  }
  return videoMetadata.channelId === allowedChannelId;
}

export async function getChannelIdFromHandle(
  handle: string,
  apiKey: string
): Promise<string | null> {
  const channelHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${channelHandle}&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`YouTube API error ${response.status}:`, errorText);
    throw new Error(`YouTube API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as YouTubeChannelResponse;
  if (data.items && data.items.length > 0 && data.items[0].id) {
    return data.items[0].id;
  }

  return null;
}
