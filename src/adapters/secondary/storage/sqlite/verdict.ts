import type Database from "better-sqlite3";
import type { Verdict } from "../../../../core/domain/verdict.js";
import type { TableDefinition } from "./migrate.js";

/** Verdicts table. Every filter's judgment on every offer, per run. */
export const verdictTable: TableDefinition = {
	table: "verdicts",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE verdicts (
	run_id TEXT NOT NULL,
	offer_id TEXT NOT NULL REFERENCES offers(id),
	filter_id TEXT NOT NULL,
	outcome TEXT NOT NULL,
	reason TEXT NOT NULL DEFAULT ''
);`,
};

/** Appends a filter's verdict for an offer in a run. */
export async function recordVerdict(
	database: Database.Database,
	offerId: string,
	runId: string,
	verdict: Verdict,
): Promise<void> {
	database
		.prepare(
			"INSERT INTO verdicts (run_id, offer_id, filter_id, outcome, reason) VALUES (?, ?, ?, ?, ?)",
		)
		.run(runId, offerId, verdict.filterId, verdict.outcome, verdict.reason);
}
