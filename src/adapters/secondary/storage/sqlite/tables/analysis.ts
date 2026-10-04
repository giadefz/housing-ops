import type { TableDefinition } from "../migrate.js";

/** Analyses table. Recorded judgments on offers, cheap or deep, append-only. */
export const analysisTable: TableDefinition = {
	table: "analyses",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE analyses (
	id TEXT PRIMARY KEY,
	offer_id TEXT NOT NULL REFERENCES offers(id),
	tier TEXT NOT NULL,
	verdict TEXT NOT NULL,
	reason TEXT NOT NULL DEFAULT '',
	pros TEXT NOT NULL,
	cons TEXT NOT NULL,
	price_assessment TEXT,
	red_flags TEXT,
	recommendation TEXT,
	confidence REAL,
	author TEXT NOT NULL,
	created_at TEXT NOT NULL
);`,
};
