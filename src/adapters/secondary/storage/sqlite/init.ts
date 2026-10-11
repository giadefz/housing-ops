import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { databasePath } from "../../workspace.js";
import { migrate } from "./migrate.js";

/** Creates the workspace database and applies migrations. Idempotent. */
export function initDatabase(root: string): void {
	const file = databasePath(root);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const database = new Database(file);
	try {
		migrate(database);
	} finally {
		database.close();
	}
}
