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

const BROADCASTS_ENDPOINT = "https://api.convertkit.com/v4/broadcasts";
const LIST_ATTEMPTS = 3;
const MAX_LIST_PAGES = 50;

interface BroadcastListPage {
  broadcasts?: ConvertKitBroadcast[];
  pagination?: {
    has_next_page?: boolean;
    end_cursor?: string | null;
  };
}

async function fetchBroadcastPage(
  apiKey: string,
  after: string | undefined,
  retryDelayMs: number
): Promise<BroadcastListPage> {
  const url = new URL(BROADCASTS_ENDPOINT);
  if (after) url.searchParams.set("after", after);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= LIST_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Kit-Api-Key": apiKey,
        },
      });

      if (response.ok) {
        return (await response.json()) as BroadcastListPage;
      }

      lastError = new Error(`ConvertKit API error: ${response.status}`);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < LIST_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * retryDelayMs));
    }
  }

  throw new Error(
    `Could not list ConvertKit broadcasts: ${lastError?.message ?? "unknown error"}`
  );
}

/**
 * Every town hall summary broadcast in the account.
 *
 * Throws when ConvertKit cannot be read. It used to log and return an empty
 * list instead, and an empty list means "nothing has been summarized yet": one
 * 429 or 5xx from ConvertKit would have re-summarized and re-published every
 * town hall in the lookback window as a duplicate.
 */
export async function getTownHallBroadcasts(
  apiKey: string,
  options: { retryDelayMs?: number } = {}
): Promise<ConvertKitBroadcast[]> {
  const allBroadcasts: ConvertKitBroadcast[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const data = await fetchBroadcastPage(
      apiKey,
      after,
      options.retryDelayMs ?? 2000
    );
    allBroadcasts.push(...(data.broadcasts || []));

    const next = data.pagination?.end_cursor;
    if (!data.pagination?.has_next_page || !next || next === after) break;
    after = next;
  }

  // Filter broadcasts to only include town hall summaries
  // We identify them by content markers, not tags (since ConvertKit doesn't support tagging broadcasts)
  return allBroadcasts.filter(isTownHallSummary);
}

export function extractBroadcastVideoId(
  broadcast: ConvertKitBroadcast
): string | null {
  const match = broadcast.content?.match(
    /TOWNHALL_VIDEO_ID:([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/** Town hall broadcasts keyed by the video they summarize. */
export function indexBroadcastsByVideoId(
  broadcasts: ConvertKitBroadcast[]
): Map<string, ConvertKitBroadcast> {
  const byVideoId = new Map<string, ConvertKitBroadcast>();
  for (const broadcast of broadcasts) {
    const videoId = extractBroadcastVideoId(broadcast);
    if (videoId && !byVideoId.has(videoId)) byVideoId.set(videoId, broadcast);
  }
  return byVideoId;
}

/** Throws when ConvertKit cannot be read; see `getTownHallBroadcasts`. */
export async function findBroadcastByVideoId(
  videoId: string,
  apiKey: string
): Promise<ConvertKitBroadcast | null> {
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
