import type { TableDefinition } from "../migrate.js";

/** Runs table. One row per pipeline execution. */
export const runTable: TableDefinition = {
	table: "runs",
	dependsOn: [],
	createTable: `
CREATE TABLE runs (
	run_id TEXT PRIMARY KEY,
	provider TEXT NOT NULL,
	started_at TEXT NOT NULL,
	finished_at TEXT,
	stats TEXT
);`,
};
