import type Database from "better-sqlite3";
import { z } from "zod";
import type { OfferVersion, Price } from "../../../../core/domain/offer.js";
import type { TableDefinition } from "./migrate.js";
import { CorruptRowError, parseJson, requireJson, rowId } from "./row.js";

/** Offer versions table. Immutable snapshots, one row per fetch. */
export const offerVersionTable: TableDefinition = {
	table: "offer_versions",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE offer_versions (
	offer_id TEXT NOT NULL REFERENCES offers(id),
	version INTEGER NOT NULL,
	fetched_at TEXT NOT NULL,
	price TEXT NOT NULL,
	payload TEXT,
	PRIMARY KEY (offer_id, version)
);`,
};

const OfferVersionRowSchema = z.object({
	offer_id: z.string(),
	version: z.number(),
	fetched_at: z.string(),
	price: z.string(),
	payload: z.string().nullable(),
});

/** Offer versions row DTO. */
export type OfferVersionRow = z.infer<typeof OfferVersionRowSchema>;

export function toOfferVersionRow(
	offerId: string,
	version: OfferVersion,
): OfferVersionRow {
	return {
		offer_id: offerId,
		version: version.version,
		fetched_at: version.fetchedAt,
		price: JSON.stringify(version.price),
		payload:
			version.payload === undefined
				? null
				: JSON.stringify(version.payload),
	};
}

export function fromOfferVersionRow(row: unknown): OfferVersion {
	const parsed = OfferVersionRowSchema.safeParse(row);
	if (!parsed.success)
		throw new CorruptRowError(
			"offer_versions",
			rowId(row),
			parsed.error.message,
		);
	const valid = parsed.data;
	return {
		version: valid.version,
		fetchedAt: valid.fetched_at,
		price: requireJson<Price>(
			"offer_versions",
			valid.offer_id,
			"price",
			valid.price,
		),
		payload: parseJson<unknown>(
			"offer_versions",
			valid.offer_id,
			"payload",
			valid.payload,
		),
	};
}

/** Inserts a version unless it already exists. */
export function insertVersion(
	database: Database.Database,
	offerId: string,
	version: OfferVersion,
): void {
	const row = toOfferVersionRow(offerId, version);
	database
		.prepare(
			"INSERT OR IGNORE INTO offer_versions (offer_id, version, fetched_at, price, payload) VALUES (?, ?, ?, ?, ?)",
		)
		.run(row.offer_id, row.version, row.fetched_at, row.price, row.payload);
}

/** Lists an offer's versions in order. */
export function listVersions(
	database: Database.Database,
	offerId: string,
): OfferVersion[] {
	const rows: unknown[] = database
		.prepare(
			"SELECT * FROM offer_versions WHERE offer_id = ? ORDER BY version",
		)
		.all(offerId);
	return rows.map((row) => fromOfferVersionRow(row));
}
