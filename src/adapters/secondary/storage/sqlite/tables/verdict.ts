import type { TableDefinition } from "../migrate.js";

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
