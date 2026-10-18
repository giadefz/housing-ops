import type Database from "better-sqlite3";
import type { TableDefinition } from "./migrate.js";

/** Pool table. The shared, durable set of offers that passed the pool filter. */
export const poolTable: TableDefinition = {
	table: "pool",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE pool (
	offer_id TEXT PRIMARY KEY REFERENCES offers(id),
	entered_at TEXT NOT NULL
);`,
};

/** Adds an offer to the pool. Idempotent: a re-seen offer keeps its first entry time. */
export async function addToPool(
	database: Database.Database,
	offerId: string,
	enteredAt: string,
): Promise<void> {
	database
		.prepare(
			"INSERT OR IGNORE INTO pool (offer_id, entered_at) VALUES (?, ?)",
		)
		.run(offerId, enteredAt);
}
