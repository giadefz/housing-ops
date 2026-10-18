import type Database from "better-sqlite3";
import { z } from "zod";
import type { OfferVersion, Price } from "../../../../core/domain/offer.js";
import type { TableDefinition } from "./migrate.js";
import {
	CorruptRecordError,
	parseJson,
	requireJson,
	recordId,
} from "./record.js";

/** Offer versions table. Immutable snapshots, one record per fetch. */
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

const OfferVersionRecordSchema = z.object({
	offer_id: z.string(),
	version: z.number(),
	fetched_at: z.string(),
	price: z.string(),
	payload: z.string().nullable(),
});

/** Offer versions record DTO. */
export type OfferVersionRecord = z.infer<typeof OfferVersionRecordSchema>;

function toRecord(offerId: string, version: OfferVersion): OfferVersionRecord {
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

function toDomain(record: unknown): OfferVersion {
	const parsed = OfferVersionRecordSchema.safeParse(record);
	if (!parsed.success)
		throw new CorruptRecordError(
			"offer_versions",
			recordId(record),
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
	const record = toRecord(offerId, version);
	database
		.prepare(
			"INSERT OR IGNORE INTO offer_versions (offer_id, version, fetched_at, price, payload) VALUES (?, ?, ?, ?, ?)",
		)
		.run(
			record.offer_id,
			record.version,
			record.fetched_at,
			record.price,
			record.payload,
		);
}

/** Lists an offer's versions in order. */
export function listVersions(
	database: Database.Database,
	offerId: string,
): OfferVersion[] {
	const records: unknown[] = database
		.prepare(
			"SELECT * FROM offer_versions WHERE offer_id = ? ORDER BY version",
		)
		.all(offerId);
	return records.map((record) => toDomain(record));
}

/** Lists versions for many offers in one query, keyed by offer id. */
export function listVersionsForOffers(
	database: Database.Database,
	offerIds: string[],
): Map<string, OfferVersion[]> {
	const versions = new Map<string, OfferVersion[]>();
	if (offerIds.length === 0) return versions;
	const placeholders = offerIds.map(() => "?").join(", ");
	const records: unknown[] = database
		.prepare(
			`SELECT * FROM offer_versions WHERE offer_id IN (${placeholders})
			ORDER BY offer_id, version`,
		)
		.all(...offerIds);
	for (const record of records) {
		const offerId = offerIdOf(record);
		const list = versions.get(offerId) ?? [];
		list.push(toDomain(record));
		versions.set(offerId, list);
	}
	return versions;
}

function offerIdOf(record: unknown): string {
	if (
		typeof record === "object" &&
		record !== null &&
		"offer_id" in record &&
		typeof record.offer_id === "string"
	) {
		return record.offer_id;
	}
	return "unknown";
}
