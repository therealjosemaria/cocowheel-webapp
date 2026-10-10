import { createInterface } from "node:readline/promises";
import db from "../server/db";
import { initializeAdmin, provisionAdmin } from "../server/admin";

// Pipe two lines from a hidden terminal prompt; never pass passwords in argv.
async function main() {
  const lines = createInterface({ input: process.stdin });
  const values: string[] = [];
  for await (const line of lines) {
    values.push(line);
    if (values.length === 2) break;
  }
  if (values.length !== 2)
    throw new Error("Provide username and password on stdin");
  initializeAdmin(db);
  provisionAdmin(db, values[0], values[1]);
  db.close();
  console.info("Admin configured. Existing admin sessions revoked.");
}
void main().catch(() => {
  console.error("Admin setup failed. Check input and database configuration.");
  process.exitCode = 1;
});
