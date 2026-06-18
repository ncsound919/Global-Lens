import { syncRSSNews } from "../rss";

(async () => {
  console.log("Starting script sync...");
  await syncRSSNews();
  console.log("Sync complete.");
  process.exit(0);
})();
