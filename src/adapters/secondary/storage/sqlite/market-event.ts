import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { MarketOutcome } from "../../../../core/domain/offer.js";
import type { TableDefinition } from "./migrate.js";

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

/** Records a market outcome and closes the offer in one transaction. */
export async function markMarketOutcome(
	database: Database.Database,
	offerId: string,
	outcome: MarketOutcome,
	observedAt: string,
	runId?: string,
): Promise<void> {
	const mark = database.transaction(() => {
		database
			.prepare(
				"INSERT INTO market_events (id, offer_id, outcome, observed_at, run_id) VALUES (?, ?, ?, ?, ?)",
			)
			.run(
				crypto.randomUUID(),
				offerId,
				outcome,
				observedAt,
				runId ?? null,
			);
		database
			.prepare("UPDATE offers SET status = ? WHERE id = ?")
			.run(outcome, offerId);
	});
	mark();
}
