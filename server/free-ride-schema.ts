import type Database from "better-sqlite3";

/** Rebuild only the legacy fare CHECK; copy every column and preserve dependants. */
export function allowFreeRideFares(db: Database.Database) {
  const table = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='rides'",
    )
    .get() as { sql: string };
  const oldCheck = /CHECK\s*\(\s*(?:price_aud\s*=\s*0\s+OR\s+)?price_aud\s*>=\s*5\s*\)/i;
  if (!oldCheck.test(table.sql)) return;
  const foreignKeys = db.pragma("foreign_keys", { simple: true });
  const objects = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE tbl_name='rides' AND type IN ('index','trigger') AND sql IS NOT NULL",
    )
    .all() as { sql: string }[];
  const columns = (
    db.prepare("PRAGMA table_info(rides)").all() as { name: string }[]
  )
    .map(({ name }) => `"${name.replaceAll('"', '""')}"`)
    .join(",");
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(
        table.sql
          .replace(
            /^CREATE TABLE\s+"?rides"?/i,
            "CREATE TABLE rides_free_migration",
          )
          .replace(oldCheck, "CHECK (price_aud = 0 OR price_aud >= 1)"),
      );
      db.exec(
        `INSERT INTO rides_free_migration (rowid,${columns}) SELECT rowid,${columns} FROM rides`,
      );
      // Do not rename the old table: SQLite would rewrite child foreign keys.
      db.exec(
        "DROP TABLE rides; ALTER TABLE rides_free_migration RENAME TO rides",
      );
      for (const object of objects) db.exec(object.sql);
      if (db.prepare("PRAGMA foreign_key_check").all().length)
        throw new Error("FREE_RIDE_MIGRATION_FOREIGN_KEY_FAILURE");
    })();
  } finally {
    db.pragma(`foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  }
}
