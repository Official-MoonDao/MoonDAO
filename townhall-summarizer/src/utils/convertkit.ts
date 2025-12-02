export interface ConvertKitBroadcast {
  id: string;
  subject: string;
  content: string;
  published_at?: string;
  created_at: string;
  public: boolean;
  public_url?: string;
}

/**
 * Checks if a broadcast is a town hall summary by looking for content markers.
 * Town hall summaries contain:
 * - <!-- TOWNHALL_VIDEO_ID:... --> comment
 * - <h1>Town Hall Summary - ...</h1> heading
 */
function isTownHallSummary(broadcast: ConvertKitBroadcast): boolean {
  if (!broadcast.content) {
    return false
  }

  // Check for TOWNHALL_VIDEO_ID marker (most reliable)
  if (broadcast.content.includes('<!-- TOWNHALL_VIDEO_ID:')) {
    return true
  }

  // Check for Town Hall Summary heading (fallback)
  if (broadcast.content.includes('<h1>Town Hall Summary -')) {
    return true
  }

  return false
}

export async function getTownHallBroadcasts(
  apiKey: string
): Promise<ConvertKitBroadcast[]> {
  try {
    const endpoint = "https://api.convertkit.com/v4/broadcasts";

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
    const allBroadcasts = data.broadcasts || [];

    // Filter broadcasts to only include town hall summaries
    // We identify them by content markers, not tags (since ConvertKit doesn't support tagging broadcasts)
    return allBroadcasts.filter(isTownHallSummary);
  } catch (error) {
    console.error("Error fetching ConvertKit broadcasts:", error);
    return [];
  }
}

export async function findBroadcastByVideoId(
  videoId: string,
  apiKey: string
): Promise<ConvertKitBroadcast | null> {
  try {
    const broadcasts = await getTownHallBroadcasts(apiKey);

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
  apiKey: string
): Promise<ConvertKitBroadcast> {
  console.log("Creating ConvertKit broadcast as draft");
  const broadcastEndpoint = "https://api.convertkit.com/v4/broadcasts";

  const body = {
    subject: subject,
    content: content,
    public: true,
    send_at: null, // null = draft (requires manual send)
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

  console.log(
    `Broadcast draft created successfully: ${broadcast.id} (requires manual send in ConvertKit)`
  );
  return broadcast;
}

export async function tagBroadcast(
  broadcastId: string,
  tagId: string,
  apiKey: string
): Promise<void> {
  const tagEndpoint = `https://api.convertkit.com/v4/broadcasts/${broadcastId}/tags`;

  const response = await fetch(tagEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify({
      tag_id: tagId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to tag broadcast ${broadcastId} with tag ${tagId}: ${response.status} ${errorText}`
    );
  }

  console.log(`✅ Successfully tagged broadcast ${broadcastId} with tag ${tagId}`);
}

export async function deleteBroadcast(
  broadcastId: string,
  apiKey: string
): Promise<void> {
  const deleteEndpoint = `https://api.convertkit.com/v4/broadcasts/${broadcastId}`;

  const response = await fetch(deleteEndpoint, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to delete broadcast ${broadcastId}: ${response.status} ${errorText}`
    );
  }

  console.log(`✅ Successfully deleted broadcast ${broadcastId}`);
}
