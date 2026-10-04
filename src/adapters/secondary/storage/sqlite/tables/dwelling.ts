import type { TableDefinition } from "../migrate.js";

/** Dwellings table. One row per known place, keyed by normalized address. */
export const dwellingTable: TableDefinition = {
	table: "dwellings",
	dependsOn: [],
	createTable: `
CREATE TABLE dwellings (
	id TEXT PRIMARY KEY,
	address_key TEXT NOT NULL UNIQUE,
	address TEXT NOT NULL,
	size TEXT,
	rooms TEXT,
	layout TEXT NOT NULL,
	year_built INTEGER,
	floor INTEGER,
	floors_total INTEGER,
	attributes TEXT NOT NULL
);`,
};
