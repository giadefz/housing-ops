import type { TableDefinition } from "../migrate.js";

/** Market events table. Let/sold/gone observations, append-only. */
export const marketEventTable: TableDefinition = {
	table: "market_events",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE market_events (
	id TEXT PRIMARY KEY,
	offer_id TEXT NOT NULL REFERENCES offers(id),
	outcome TEXT NOT NULL,
	observed_at TEXT NOT NULL,
	run_id TEXT
);`,
};
