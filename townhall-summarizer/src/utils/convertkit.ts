export interface ConvertKitBroadcast {
  id: string;
  subject: string;
  content: string;
  published_at?: string;
  created_at: string;
  public: boolean;
  public_url?: string;
}

export async function getTownHallBroadcasts(
  apiKey: string,
  tagId?: string
): Promise<ConvertKitBroadcast[]> {
  try {
    const endpoint = tagId
      ? `https://api.convertkit.com/v4/broadcasts?tag_id=${tagId}`
      : "https://api.convertkit.com/v4/broadcasts";

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Kit-Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ConvertKit API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      broadcasts?: ConvertKitBroadcast[];
    };
    return data.broadcasts || [];
  } catch (error) {
    console.error("Error fetching ConvertKit broadcasts:", error);
    return [];
  }
}

export async function findBroadcastByVideoId(
  videoId: string,
  apiKey: string,
  tagId?: string
): Promise<ConvertKitBroadcast | null> {
  try {
    const broadcasts = await getTownHallBroadcasts(apiKey, tagId);

    for (const broadcast of broadcasts) {
      if (
        broadcast.content &&
        broadcast.content.includes(`TOWNHALL_VIDEO_ID:${videoId}`)
      ) {
        return broadcast;
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding broadcast by video ID:", error);
    return null;
  }
}

export async function createConvertKitBroadcast(
  subject: string,
  content: string,
  apiKey: string,
  tagId?: string
): Promise<ConvertKitBroadcast> {
  console.log("Creating ConvertKit broadcast...");
  const broadcastEndpoint = "https://api.convertkit.com/v4/broadcasts";

  const body = {
    subject: subject,
    content: content,
    public: true,
    send_at: null,
  };

  const response = await fetch(broadcastEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ConvertKit API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { broadcast: ConvertKitBroadcast };
  const broadcast = data.broadcast;

  if (tagId && broadcast?.id) {
    await tagBroadcast(broadcast.id, tagId, apiKey);
  }

  console.log(`Broadcast created successfully: ${broadcast.id}`);
  return broadcast;
}

export async function tagBroadcast(
  broadcastId: string,
  tagId: string,
  apiKey: string
): Promise<void> {
  const tagEndpoint = `https://api.convertkit.com/v4/broadcasts/${broadcastId}/tags`;

  await fetch(tagEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify({
      tag_id: tagId,
    }),
  });
}
