import type Database from "better-sqlite3";
import { z } from "zod";
import { INTERACTION_ACTIONS } from "../../../../core/domain/analysis.js";
import type { Interaction } from "../../../../core/domain/analysis.js";
import type { TableDefinition } from "./migrate.js";
import { CorruptRecordError, parseEnum, recordId } from "./record.js";

/** Interactions table. Recorded user reactions on offers, append-only. */
export const interactionTable: TableDefinition = {
	table: "interactions",
	dependsOn: ["members", "offers"],
	createTable: `
CREATE TABLE interactions (
	id TEXT PRIMARY KEY,
	member_id TEXT NOT NULL REFERENCES members(id),
	offer_id TEXT NOT NULL REFERENCES offers(id),
	action TEXT NOT NULL,
	reason TEXT,
	created_at TEXT NOT NULL
);`,
};

const InteractionRecordSchema = z.object({
	id: z.string(),
	member_id: z.string(),
	offer_id: z.string(),
	action: z.string(),
	reason: z.string().nullable(),
	created_at: z.string(),
});

/** Interactions record DTO. */
export type InteractionRecord = z.infer<typeof InteractionRecordSchema>;

function toRecord(interaction: Interaction): InteractionRecord {
	return {
		id: interaction.id,
		member_id: interaction.memberId,
		offer_id: interaction.offerId,
		action: interaction.action,
		reason: interaction.reason ?? null,
		created_at: interaction.createdAt,
	};
}

function toDomain(record: unknown): Interaction {
	const parsed = InteractionRecordSchema.safeParse(record);
	if (!parsed.success)
		throw new CorruptRecordError(
			"interactions",
			recordId(record),
			parsed.error.message,
		);
	const valid = parsed.data;
	return {
		id: valid.id,
		memberId: valid.member_id,
		offerId: valid.offer_id,
		action: parseEnum(
			"interactions",
			valid.id,
			"action",
			valid.action,
			INTERACTION_ACTIONS,
		),
		reason: valid.reason ?? undefined,
		createdAt: valid.created_at,
	};
}

/** Appends an interaction. */
export async function recordInteraction(
	database: Database.Database,
	interaction: Interaction,
): Promise<void> {
	const record = toRecord(interaction);
	database
		.prepare(
			"INSERT INTO interactions (id, member_id, offer_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.run(
			record.id,
			record.member_id,
			record.offer_id,
			record.action,
			record.reason,
			record.created_at,
		);
}

/** Lists a member's interactions on an offer, in order. */
export function listInteractions(
	database: Database.Database,
	memberId: string,
	offerId: string,
): Interaction[] {
	const records: unknown[] = database
		.prepare(
			"SELECT * FROM interactions WHERE member_id = ? AND offer_id = ? ORDER BY created_at",
		)
		.all(memberId, offerId);
	return records.map((record) => toDomain(record));
}
