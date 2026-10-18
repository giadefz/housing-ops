import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { StoreDescription } from "../../../../core/ports/store.port.js";
import { DATABASE_FILE, databasePath } from "./location.js";
import { migrate, SCHEMA_VERSION } from "./migrate.js";

/** Creates the workspace database, applies migrations, and describes it. Idempotent. */
export function initDatabase(root: string): StoreDescription {
	const file = databasePath(root);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const database = new Database(file);
	try {
		migrate(database);
	} finally {
		database.close();
	}
	return { location: DATABASE_FILE, schemaVersion: SCHEMA_VERSION };
}
