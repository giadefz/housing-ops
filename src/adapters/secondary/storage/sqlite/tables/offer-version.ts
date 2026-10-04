import type { TableDefinition } from "../migrate.js";

/** Offer versions table. Immutable snapshots, one row per fetch. */
export const offerVersionTable: TableDefinition = {
	table: "offer_versions",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE offer_versions (
	offer_id TEXT NOT NULL REFERENCES offers(id),
	version INTEGER NOT NULL,
	fetched_at TEXT NOT NULL,
	price TEXT NOT NULL,
	payload TEXT,
	PRIMARY KEY (offer_id, version)
);`,
};
