import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { DeadLetterEntry } from "../../../../core/ports/store.port.js";
import type { TableDefinition } from "./migrate.js";

/** Dead-letter table. Listings that failed normalization, never silently dropped. */
export const deadLetterTable: TableDefinition = {
	table: "dead_letter",
	dependsOn: [],
	createTable: `
CREATE TABLE dead_letter (
	id TEXT PRIMARY KEY,
	run_id TEXT NOT NULL,
	provider TEXT NOT NULL,
	payload TEXT NOT NULL,
	error TEXT NOT NULL,
	received_at TEXT NOT NULL
);`,
};

/** Appends a dead-letter entry and returns its id. */
export function recordDeadLetter(
	database: Database.Database,
	entry: DeadLetterEntry,
): string {
	const id = crypto.randomUUID();
	database
		.prepare(
			"INSERT INTO dead_letter (id, run_id, provider, payload, error, received_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.run(
			id,
			entry.runId,
			entry.provider,
			JSON.stringify(entry.payload),
			entry.error,
			entry.receivedAt,
		);
	return id;
}
