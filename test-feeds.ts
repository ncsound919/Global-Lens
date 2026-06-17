import Parser from "rss-parser";
import { feeds } from "./feeds";

const parser = new Parser();

async function run() {
  for (const feed of feeds) {
    try {
      await parser.parseURL(feed.url);
      console.log('OK:', feed.url);
    } catch (err: any) {
      console.log('FAIL:', feed.url, err.message);
    }
  }
}
run();
