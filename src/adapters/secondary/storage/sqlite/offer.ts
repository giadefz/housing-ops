import type Database from "better-sqlite3";
import { z } from "zod";
import { MARKETS, OFFER_STATUSES } from "../../../../core/domain/offer.js";
import type { Offer, Price } from "../../../../core/domain/offer.js";
import { listAnalyses } from "./analysis.js";
import { listInteractions } from "./interaction.js";
import type { TableDefinition } from "./migrate.js";
import { insertVersion, listVersions } from "./offer-version.js";
import { CorruptRowError, parseEnum, requireJson, rowId } from "./row.js";

/** Offers table. One row per market sighting, versioned in offer_versions. */
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
	UNIQUE(provider, listing_id)
);`,
};

const OfferRowSchema = z.object({
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
});

/** Offers row DTO. JSON columns are text, absent values are null. */
export type OfferRow = z.infer<typeof OfferRowSchema>;

/** An offer without its children. Versions, analyses, and interactions load separately. */
export type StoredOffer = Omit<Offer, "versions" | "analyses" | "interactions">;

export function toOfferRow(offer: Offer): OfferRow {
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
		status: offer.status,
	};
}

export function fromOfferRow(row: unknown): StoredOffer {
	const parsed = OfferRowSchema.safeParse(row);
	if (!parsed.success)
		throw new CorruptRowError("offers", rowId(row), parsed.error.message);
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
		status: parseEnum(
			"offers",
			valid.id,
			"status",
			valid.status,
			OFFER_STATUSES,
		),
	};
}

/** Persists an offer row and any new versions. Re-saving is idempotent. */
export async function saveOffer(
	database: Database.Database,
	offer: Offer,
): Promise<void> {
	const save = database.transaction((current: Offer) => {
		upsertOfferRow(database, current);
		for (const version of current.versions)
			insertVersion(database, current.id, version);
	});
	save(offer);
}

function upsertOfferRow(database: Database.Database, offer: Offer): void {
	const row = toOfferRow(offer);
	database
		.prepare(
			`INSERT INTO offers (id, dwelling_id, provider, listing_id, url, market, price, images, description, posted_at, fetched_at, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET dwelling_id = excluded.dwelling_id, provider = excluded.provider,
			listing_id = excluded.listing_id, url = excluded.url, market = excluded.market, price = excluded.price,
			images = excluded.images, description = excluded.description, posted_at = excluded.posted_at,
			fetched_at = excluded.fetched_at, status = excluded.status`,
		)
		.run(
			row.id,
			row.dwelling_id,
			row.provider,
			row.listing_id,
			row.url,
			row.market,
			row.price,
			row.images,
			row.description,
			row.posted_at,
			row.fetched_at,
			row.status,
		);
}

/** Loads a full offer with versions, analyses, and interactions. Null when unknown. */
export async function findOffer(
	database: Database.Database,
	id: string,
): Promise<Offer | null> {
	const row: unknown = database
		.prepare("SELECT * FROM offers WHERE id = ?")
		.get(id);
	if (row === undefined) return null;
	return assembleOffer(database, fromOfferRow(row));
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
	const row: unknown = database
		.prepare("SELECT id FROM offers WHERE provider = ? AND listing_id = ?")
		.get(provider, listingId);
	if (!hasId(row)) return null;
	return findOffer(database, row.id);
}

function hasId(row: unknown): row is { id: string } {
	return (
		typeof row === "object" &&
		row !== null &&
		"id" in row &&
		typeof row.id === "string"
	);
}
