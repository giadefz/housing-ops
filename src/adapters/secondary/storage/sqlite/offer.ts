import type Database from "better-sqlite3";
import { z } from "zod";
import {
	MARKET_STATUSES,
	MARKETS,
	USER_STATUSES,
} from "../../../../core/domain/offer.js";
import type { Offer, Price } from "../../../../core/domain/offer.js";
import { listAnalyses } from "./analysis.js";
import { listInteractions } from "./interaction.js";
import type { TableDefinition } from "./migrate.js";
import { insertVersion, listVersions } from "./offer-version.js";
import {
	CorruptRecordError,
	parseEnum,
	requireJson,
	recordId,
} from "./record.js";

/** Offers table. One record per market sighting, versioned in offer_versions. */
export const offerTable: TableDefinition = {
	table: "offers",
	dependsOn: ["dwellings"],
	createTable: `
CREATE TABLE offers (
	id TEXT PRIMARY KEY,
	dwelling_id TEXT NOT NULL REFERENCES dwellings(id),
	provider TEXT NOT NULL,
	listing_id TEXT NOT NULL,
	url TEXT NOT NULL,
	market TEXT NOT NULL,
	price TEXT NOT NULL,
	images TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	posted_at TEXT,
	fetched_at TEXT NOT NULL,
	status TEXT NOT NULL,
	user_status TEXT NOT NULL DEFAULT 'none',
	UNIQUE(provider, listing_id)
);`,
};

const OfferRecordSchema = z.object({
	id: z.string(),
	dwelling_id: z.string(),
	provider: z.string(),
	listing_id: z.string(),
	url: z.string(),
	market: z.string(),
	price: z.string(),
	images: z.string(),
	description: z.string(),
	posted_at: z.string().nullable(),
	fetched_at: z.string(),
	status: z.string(),
	user_status: z.string(),
});

/** Offers record DTO. JSON columns are text, absent values are null. */
export type OfferRecord = z.infer<typeof OfferRecordSchema>;

/** An offer without its children. Versions, analyses, and interactions load separately. */
export type StoredOffer = Omit<Offer, "versions" | "analyses" | "interactions">;

function toRecord(offer: Offer): OfferRecord {
	return {
		id: offer.id,
		dwelling_id: offer.dwellingId,
		provider: offer.provider,
		listing_id: offer.listingId,
		url: offer.url,
		market: offer.market,
		price: JSON.stringify(offer.price),
		images: JSON.stringify(offer.images),
		description: offer.description,
		posted_at: offer.postedAt ?? null,
		fetched_at: offer.fetchedAt,
		status: offer.marketStatus,
		user_status: offer.userStatus,
	};
}

function toDomain(record: unknown): StoredOffer {
	const parsed = OfferRecordSchema.safeParse(record);
	if (!parsed.success)
		throw new CorruptRecordError(
			"offers",
			recordId(record),
			parsed.error.message,
		);
	const valid = parsed.data;
	return {
		id: valid.id,
		dwellingId: valid.dwelling_id,
		provider: valid.provider,
		listingId: valid.listing_id,
		url: valid.url,
		market: parseEnum("offers", valid.id, "market", valid.market, MARKETS),
		price: requireJson<Price>("offers", valid.id, "price", valid.price),
		images: requireJson<string[]>(
			"offers",
			valid.id,
			"images",
			valid.images,
		),
		description: valid.description,
		postedAt: valid.posted_at ?? undefined,
		fetchedAt: valid.fetched_at,
		marketStatus: parseEnum(
			"offers",
			valid.id,
			"status",
			valid.status,
			MARKET_STATUSES,
		),
		userStatus: parseEnum(
			"offers",
			valid.id,
			"user_status",
			valid.user_status,
			USER_STATUSES,
		),
	};
}

/** Writes an offer record and any new versions. Re-writing is idempotent. */
export function writeOffer(database: Database.Database, offer: Offer): void {
	upsertOfferRecord(database, offer);
	for (const version of offer.versions)
		insertVersion(database, offer.id, version);
}

/** Persists an offer and any new versions in one transaction. */
export async function saveOffer(
	database: Database.Database,
	offer: Offer,
): Promise<void> {
	const save = database.transaction(() => writeOffer(database, offer));
	save();
}

function upsertOfferRecord(database: Database.Database, offer: Offer): void {
	const record = toRecord(offer);
	database
		.prepare(
			`INSERT INTO offers (id, dwelling_id, provider, listing_id, url, market, price, images, description, posted_at, fetched_at, status, user_status)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET dwelling_id = excluded.dwelling_id, provider = excluded.provider,
			listing_id = excluded.listing_id, url = excluded.url, market = excluded.market, price = excluded.price,
			images = excluded.images, description = excluded.description, posted_at = excluded.posted_at,
			fetched_at = excluded.fetched_at, status = excluded.status, user_status = excluded.user_status`,
		)
		.run(
			record.id,
			record.dwelling_id,
			record.provider,
			record.listing_id,
			record.url,
			record.market,
			record.price,
			record.images,
			record.description,
			record.posted_at,
			record.fetched_at,
			record.status,
			record.user_status,
		);
}

/** Loads a full offer with versions, analyses, and interactions. Null when unknown. */
export async function findOffer(
	database: Database.Database,
	id: string,
): Promise<Offer | null> {
	const record: unknown = database
		.prepare("SELECT * FROM offers WHERE id = ?")
		.get(id);
	if (record === undefined) return null;
	return assembleOffer(database, toDomain(record));
}

function assembleOffer(database: Database.Database, base: StoredOffer): Offer {
	return {
		...base,
		versions: listVersions(database, base.id),
		analyses: listAnalyses(database, base.id),
		interactions: listInteractions(database, base.id),
	};
}

/** Resolves an offer by provider and listing id. Null when unknown. */
export async function findOfferByListing(
	database: Database.Database,
	provider: string,
	listingId: string,
): Promise<Offer | null> {
	const record: unknown = database
		.prepare("SELECT id FROM offers WHERE provider = ? AND listing_id = ?")
		.get(provider, listingId);
	if (!hasId(record)) return null;
	return findOffer(database, record.id);
}

function hasId(record: unknown): record is { id: string } {
	return (
		typeof record === "object" &&
		record !== null &&
		"id" in record &&
		typeof record.id === "string"
	);
}

/** Lists recent offer ids, newest first. */
export function listOfferIds(
	database: Database.Database,
	limit: number,
): string[] {
	const records: unknown[] = database
		.prepare("SELECT id FROM offers ORDER BY fetched_at DESC LIMIT ?")
		.all(limit);
	return records.flatMap((record) => (hasId(record) ? [record.id] : []));
}
