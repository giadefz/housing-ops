import type { TableDefinition } from "../migrate.js";

/** Interactions table. Recorded user reactions on offers, append-only. */
export const interactionTable: TableDefinition = {
	table: "interactions",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE interactions (
	id TEXT PRIMARY KEY,
	offer_id TEXT NOT NULL REFERENCES offers(id),
	action TEXT NOT NULL,
	reason TEXT,
	created_at TEXT NOT NULL
);`,
};
