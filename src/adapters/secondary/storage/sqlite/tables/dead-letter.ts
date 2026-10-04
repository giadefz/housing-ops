import type { TableDefinition } from "../migrate.js";

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
