import "dotenv/config";
import { deleteBroadcast, findBroadcastByVideoId } from "./utils/convertkit";

async function main() {
  const videoIds = process.argv.slice(2);
  const apiKey =
    process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY;

  if (videoIds.length === 0) {
    console.error(
      "Usage: yarn delete-broadcast <videoId1> [videoId2] [videoId3] ..."
    );
    console.error(
      "Example: yarn delete-broadcast DcD_Wea61DI 77lhE77aN6s zrD8tSyPX2A"
    );
    process.exit(1);
  }

  if (!apiKey) {
    console.error(
      "Error: CONVERT_KIT_API_KEY or CONVERT_KIT_V4_API_KEY environment variable is required"
    );
    process.exit(1);
  }

  console.log(
    `⚠️  WARNING: This will permanently delete ${videoIds.length} broadcast(s)!\n`
  );

  const results = {
    deleted: [] as string[],
    notFound: [] as string[],
    failed: [] as { videoId: string; error: string }[],
  };

  for (const videoId of videoIds) {
    try {
      console.log(`\nProcessing video ID: ${videoId}`);
      console.log(`Finding broadcast for video ${videoId}...`);

      const broadcast = await findBroadcastByVideoId(videoId, apiKey);

      if (!broadcast) {
        console.log(`❌ No broadcast found for video ID: ${videoId}`);
        results.notFound.push(videoId);
        continue;
      }

      console.log(
        `✅ Found broadcast: ${broadcast.subject} (ID: ${broadcast.id})`
      );
      console.log(`Deleting broadcast ${broadcast.id}...`);

      await deleteBroadcast(broadcast.id, apiKey);
      console.log(`✅ Successfully deleted broadcast for video ${videoId}`);
      results.deleted.push(videoId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `❌ Failed to delete broadcast for video ${videoId}:`,
        errorMessage
      );
      results.failed.push({ videoId, error: errorMessage });
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("DELETION SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Successfully deleted: ${results.deleted.length}`);
  if (results.deleted.length > 0) {
    results.deleted.forEach((id) => console.log(`   - ${id}`));
  }

  console.log(`\n❌ Not found: ${results.notFound.length}`);
  if (results.notFound.length > 0) {
    results.notFound.forEach((id) => console.log(`   - ${id}`));
  }

  console.log(`\n⚠️  Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    results.failed.forEach(({ videoId, error }) =>
      console.log(`   - ${videoId}: ${error}`)
    );
  }

  console.log("=".repeat(60) + "\n");

  if (results.failed.length > 0 || results.notFound.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
