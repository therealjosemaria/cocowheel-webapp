import { readFileSync } from "node:fs";
import { indexNowPayload, submitIndexNow } from "../lib/indexnow.ts";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--submit")) {
  console.error("Usage: npm run search:submit [-- --submit]. No arguments performs a local dry run.");
  process.exitCode = 1;
} else {
  try {
    // This ownership proof is deliberately public, not an account/API credential.
    const key = readFileSync(new URL("../public/indexnow-key.txt", import.meta.url), "utf8").trim();
    if (args[0] === "--submit") console.log(JSON.stringify(await submitIndexNow(key), null, 2));
    else {
      const { host, keyLocation, urlList } = indexNowPayload(key);
      console.log(JSON.stringify({ mode: "dry-run", host, keyLocation, urls: urlList, submitted: false }, null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "IndexNow submission failed");
    process.exitCode = 1;
  }
}
