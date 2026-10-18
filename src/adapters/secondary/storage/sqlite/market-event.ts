import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { MarketOutcomeCommand } from "../../../../core/ports/store.port.js";
import { writeDecision } from "./decision.js";
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

/** Closes an offer and every member's decision on it, appending the market event in one transaction. */
export function recordMarketOutcome(
	database: Database.Database,
	command: MarketOutcomeCommand,
): void {
	const { offer, decisions, event } = command;
	const close = database.transaction(() => {
		writeOffer(database, offer);
		for (const decision of decisions) writeDecision(database, decision);
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
