import type Database from "better-sqlite3";
import { z } from "zod";
import { VERDICT_OUTCOMES } from "../../../../core/domain/verdict.js";
import type { Verdict } from "../../../../core/domain/verdict.js";
import type { TableDefinition } from "./migrate.js";
import { CorruptRecordError, parseEnum, recordId } from "./record.js";

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

const VerdictRecordSchema = z.object({
	run_id: z.string(),
	offer_id: z.string(),
	filter_id: z.string(),
	outcome: z.string(),
	reason: z.string(),
});

/** Verdicts record DTO. */
export type VerdictRecord = z.infer<typeof VerdictRecordSchema>;

function toDomain(record: unknown): Verdict {
	const parsed = VerdictRecordSchema.safeParse(record);
	if (!parsed.success)
		throw new CorruptRecordError(
			"verdicts",
			recordId(record),
			parsed.error.message,
		);
	const valid = parsed.data;
	return {
		filterId: valid.filter_id,
		outcome: parseEnum(
			"verdicts",
			valid.offer_id,
			"outcome",
			valid.outcome,
			VERDICT_OUTCOMES,
		),
		reason: valid.reason,
	};
}

/** Lists the verdicts recorded on an offer. */
export function listVerdicts(
	database: Database.Database,
	offerId: string,
): Verdict[] {
	const records: unknown[] = database
		.prepare("SELECT * FROM verdicts WHERE offer_id = ? ORDER BY filter_id")
		.all(offerId);
	return records.map((record) => toDomain(record));
}
