import type Database from "better-sqlite3";
import { z } from "zod";
import { INTERACTION_ACTIONS } from "../../../../core/domain/analysis.js";
import type { Interaction } from "../../../../core/domain/analysis.js";
import type { TableDefinition } from "./migrate.js";
import { CorruptRowError, parseEnum, rowId } from "./row.js";

/** Interactions table. Recorded user reactions on offers, append-only. */
export const interactionTable: TableDefinition = {
	table: "interactions",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE interactions (
	id TEXT PRIMARY KEY,
	offer_id TEXT NOT NULL REFERENCES offers(id),
	action TEXT NOT NULL,
	reason TEXT,
	created_at TEXT NOT NULL
);`,
};

const InteractionRowSchema = z.object({
	id: z.string(),
	offer_id: z.string(),
	action: z.string(),
	reason: z.string().nullable(),
	created_at: z.string(),
});

/** Interactions row DTO. */
export type InteractionRow = z.infer<typeof InteractionRowSchema>;

export function toInteractionRow(interaction: Interaction): InteractionRow {
	return {
		id: interaction.id,
		offer_id: interaction.offerId,
		action: interaction.action,
		reason: interaction.reason ?? null,
		created_at: interaction.createdAt,
	};
}

export function fromInteractionRow(row: unknown): Interaction {
	const parsed = InteractionRowSchema.safeParse(row);
	if (!parsed.success)
		throw new CorruptRowError(
			"interactions",
			rowId(row),
			parsed.error.message,
		);
	const valid = parsed.data;
	return {
		id: valid.id,
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
	const row = toInteractionRow(interaction);
	database
		.prepare(
			"INSERT INTO interactions (id, offer_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?)",
		)
		.run(row.id, row.offer_id, row.action, row.reason, row.created_at);
}

/** Lists an offer's interactions in order. */
export function listInteractions(
	database: Database.Database,
	offerId: string,
): Interaction[] {
	const rows: unknown[] = database
		.prepare(
			"SELECT * FROM interactions WHERE offer_id = ? ORDER BY created_at",
		)
		.all(offerId);
	return rows.map((row) => fromInteractionRow(row));
}
