import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { Offer } from "../../../../core/domain/offer.js";
import type { MarketOutcomeEvent } from "../../../../core/ports/store.port.js";
import type { TableDefinition } from "./migrate.js";
import { writeOffer } from "./offer.js";

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

/** Closes an offer and appends the market event in one transaction. */
export function recordMarketOutcome(
	database: Database.Database,
	offer: Offer,
	event: MarketOutcomeEvent,
): void {
	const close = database.transaction(() => {
		writeOffer(database, offer);
		database
			.prepare(
				"INSERT INTO market_events (id, offer_id, outcome, observed_at, run_id) VALUES (?, ?, ?, ?, ?)",
			)
			.run(
				crypto.randomUUID(),
				offer.id,
				event.outcome,
				event.observedAt,
				event.runId ?? null,
			);
	});
	close();
}
