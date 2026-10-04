import type { TableDefinition } from "../migrate.js";

/** Provider state table. Health and liveness per source. */
export const providersStateTable: TableDefinition = {
	table: "providers_state",
	dependsOn: [],
	createTable: `
CREATE TABLE providers_state (
	provider_id TEXT PRIMARY KEY,
	last_run TEXT,
	last_ok TEXT,
	health TEXT NOT NULL DEFAULT 'unknown',
	consecutive_failures INTEGER NOT NULL DEFAULT 0
);`,
};
