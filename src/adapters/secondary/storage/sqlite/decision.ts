import type Database from "better-sqlite3";
import { z } from "zod";
import {
	MARKET_STATUSES,
	USER_STATUSES,
	type Decision,
} from "../../../../core/domain/decision.js";
import type { TableDefinition } from "./migrate.js";
import { CorruptRecordError, parseEnum } from "./record.js";

/** Decisions table. One member's durable standing on one offer. */
export const decisionTable: TableDefinition = {
	table: "decisions",
	dependsOn: ["members", "offers"],
	createTable: `
CREATE TABLE decisions (
	member_id TEXT NOT NULL REFERENCES members(id),
	offer_id TEXT NOT NULL REFERENCES offers(id),
	market_status TEXT NOT NULL,
	user_status TEXT NOT NULL,
	PRIMARY KEY (member_id, offer_id)
);`,
};

const DecisionRecordSchema = z.object({
	member_id: z.string(),
	offer_id: z.string(),
	market_status: z.string(),
	user_status: z.string(),
});

/** Decisions record DTO. */
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

function toRecord(decision: Decision): DecisionRecord {
	return {
		member_id: decision.memberId,
		offer_id: decision.offerId,
		market_status: decision.marketStatus,
		user_status: decision.userStatus,
	};
}

function toDomain(record: unknown): Decision {
	const parsed = DecisionRecordSchema.safeParse(record);
	if (!parsed.success)
		throw new CorruptRecordError(
			"decisions",
			recordId(record),
			parsed.error.message,
		);
	const valid = parsed.data;
	return {
		memberId: valid.member_id,
		offerId: valid.offer_id,
		marketStatus: parseEnum(
			"decisions",
			recordId(record),
			"market_status",
			valid.market_status,
			MARKET_STATUSES,
		),
		userStatus: parseEnum(
			"decisions",
			recordId(record),
			"user_status",
			valid.user_status,
			USER_STATUSES,
		),
	};
}

function recordId(record: unknown): string {
	if (
		typeof record === "object" &&
		record !== null &&
		"member_id" in record &&
		"offer_id" in record
	) {
		const { member_id, offer_id } = record as Record<string, unknown>;
		return `${String(member_id)}:${String(offer_id)}`;
	}
	return "unknown";
}

/** Inserts a decision, or replaces its statuses. */
export async function saveDecision(
	database: Database.Database,
	decision: Decision,
): Promise<void> {
	const record = toRecord(decision);
	database
		.prepare(
			`INSERT INTO decisions (member_id, offer_id, market_status, user_status)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(member_id, offer_id) DO UPDATE SET
			market_status = excluded.market_status, user_status = excluded.user_status`,
		)
		.run(
			record.member_id,
			record.offer_id,
			record.market_status,
			record.user_status,
		);
}

/** Finds a member's decision on an offer. Null when unset. */
export function findDecision(
	database: Database.Database,
	memberId: string,
	offerId: string,
): Decision | null {
	const record: unknown = database
		.prepare("SELECT * FROM decisions WHERE member_id = ? AND offer_id = ?")
		.get(memberId, offerId);
	return record === undefined ? null : toDomain(record);
}

/** Lists a member's decisions, in offer id order. */
export function listDecisions(
	database: Database.Database,
	memberId: string,
): Decision[] {
	const records: unknown[] = database
		.prepare(
			"SELECT * FROM decisions WHERE member_id = ? ORDER BY offer_id",
		)
		.all(memberId);
	return records.map((record) => toDomain(record));
}
