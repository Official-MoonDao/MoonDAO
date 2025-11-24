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
}

interface YouTubeVideoResponse {
  items?: Array<{
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

export async function getVideoMetadata(
  videoId: string,
  apiKey: string
): Promise<YouTubeVideoMetadata | null> {
  try {
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoId}&key=${apiKey}`;

    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = (await response.json()) as YouTubeVideoResponse;

    if (!data.items || data.items.length === 0) {
      return null;
    }

    const video = data.items[0];
    const snippet = video.snippet;
    const contentDetails = video.contentDetails;
    const status = video.status;

    if (!snippet) {
      return null;
    }

    return {
      id: videoId,
      title: snippet.title || "",
      description: snippet.description || "",
      thumbnail:
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        "",
      publishedAt: snippet.publishedAt || "",
      duration: contentDetails?.duration || "",
      channelId: snippet.channelId || "",
      channelTitle: snippet.channelTitle || "",
      liveBroadcastContent: snippet.liveBroadcastContent || status?.liveBroadcastContent,
    };
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
  try {
    const channelHandle = handle.startsWith("@") ? handle.slice(1) : handle;
    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${channelHandle}&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = (await response.json()) as YouTubeChannelResponse;
    if (data.items && data.items.length > 0 && data.items[0].id) {
      return data.items[0].id;
    }

    return null;
  } catch (error) {
    console.error("Error fetching channel ID from handle:", error);
    return null;
  }
}

