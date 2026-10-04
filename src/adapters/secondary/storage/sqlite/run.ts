import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { RunStats } from "../../../../core/ports/store.port.js";
import type { TableDefinition } from "./migrate.js";

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

/** Opens a run and returns its id. */
export async function startRun(
	database: Database.Database,
	provider: string,
): Promise<string> {
	const runId = crypto.randomUUID();
	database
		.prepare(
			"INSERT INTO runs (run_id, provider, started_at, finished_at, stats) VALUES (?, ?, ?, NULL, NULL)",
		)
		.run(runId, provider, new Date().toISOString());
	return runId;
}

/** Closes a run with its counters. */
export async function finishRun(
	database: Database.Database,
	runId: string,
	stats: RunStats,
): Promise<void> {
	database
		.prepare("UPDATE runs SET finished_at = ?, stats = ? WHERE run_id = ?")
		.run(new Date().toISOString(), JSON.stringify(stats), runId);
}
