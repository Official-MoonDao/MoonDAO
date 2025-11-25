import { getChannelIdFromHandle } from "./youtube";

async function main() {
  const handle = process.argv[2];

  if (!handle) {
    console.error("Usage: ts-node src/utils/get-channel-id.ts <@handle>");
    console.error(
      "Example: ts-node src/utils/get-channel-id.ts @officialmoondao"
    );
    process.exit(1);
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("Error: YOUTUBE_API_KEY environment variable is required");
    process.exit(1);
  }

  try {
    const channelId = await getChannelIdFromHandle(handle, apiKey);
    if (channelId) {
      console.log(`Channel ID for ${handle}: ${channelId}`);
      console.log(`\nSet this in your environment:`);
      console.log(`export ALLOWED_YOUTUBE_CHANNEL_ID=${channelId}`);
    } else {
      console.error(`Channel not found for handle: ${handle}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}

main();
