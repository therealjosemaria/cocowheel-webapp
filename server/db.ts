import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function openDatabase(
  databasePath = process.env.COCOWHEELS_DB_PATH ??
    path.join(process.cwd(), "data", "cocowheels.db"),
) {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  return database;
}

const db = openDatabase();
export default db;
