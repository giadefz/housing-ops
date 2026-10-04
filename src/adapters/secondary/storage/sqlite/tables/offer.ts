import type { TableDefinition } from "../migrate.js";

/** Offers table. One row per market sighting, versioned in offer_versions. */
export const offerTable: TableDefinition = {
	table: "offers",
	dependsOn: ["dwellings"],
	createTable: `
CREATE TABLE offers (
	id TEXT PRIMARY KEY,
	dwelling_id TEXT NOT NULL REFERENCES dwellings(id),
	provider TEXT NOT NULL,
	listing_id TEXT NOT NULL,
	url TEXT NOT NULL,
	market TEXT NOT NULL,
	price TEXT NOT NULL,
	images TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	posted_at TEXT,
	fetched_at TEXT NOT NULL,
	status TEXT NOT NULL,
	UNIQUE(provider, listing_id)
);`,
};
