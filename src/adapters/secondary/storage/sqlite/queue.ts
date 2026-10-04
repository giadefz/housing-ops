import type Database from "better-sqlite3";
import { z } from "zod";
import { toSquareMeters } from "../../../../core/domain/dwelling.js";
import { OFFER_STATUSES } from "../../../../core/domain/offer.js";
import type { OfferStatus } from "../../../../core/domain/offer.js";
import type { OfferSummary } from "../../../../core/ports/store.port.js";
import {
	CorruptRecordError,
	parseEnum,
	parseJson,
	requireJson,
} from "./record.js";

const QueueRecordSchema = z.object({
	id: z.string(),
	provider: z.string(),
	price: z.string(),
	status: z.string(),
	fetched_at: z.string(),
	address: z.string(),
	size: z.string().nullable(),
	rooms: z.string().nullable(),
	layout: z.string(),
});

/** Queue projection over offers joined to their dwelling. Compact records only. */
export function listQueue(
	database: Database.Database,
	status: OfferStatus,
	limit: number,
): OfferSummary[] {
	const records: unknown[] = database
		.prepare(
			`SELECT o.id AS id, o.provider AS provider, o.price AS price, o.status AS status, o.fetched_at AS fetched_at,
			d.address AS address, d.size AS size, d.rooms AS rooms, d.layout AS layout
			FROM offers o JOIN dwellings d ON d.id = o.dwelling_id
			WHERE o.status = ? ORDER BY o.fetched_at LIMIT ?`,
		)
		.all(status, limit);
	return records.map((record) => toSummary(record));
}

interface StoredPrice {
	amount: number;
	currency: string;
}

function toSummary(record: unknown): OfferSummary {
	const parsed = QueueRecordSchema.safeParse(record);
	if (!parsed.success)
		throw new CorruptRecordError("queue", "unknown", parsed.error.message);
	const valid = parsed.data;
	const price = requireJson<StoredPrice>(
		"queue",
		valid.id,
		"price",
		valid.price,
	);
	const address = requireJson<{ freeText: string }>(
		"queue",
		valid.id,
		"address",
		valid.address,
	);
	const size = parseJson<{ value: number; unit: "m2" | "sqft" }>(
		"queue",
		valid.id,
		"size",
		valid.size,
	);
	const rooms = parseJson<{ bedrooms?: number }>(
		"queue",
		valid.id,
		"rooms",
		valid.rooms,
	);
	return {
		id: valid.id,
		provider: valid.provider,
		price: { amount: price.amount, currency: price.currency },
		addressShort: address.freeText,
		bedrooms: rooms?.bedrooms,
		sizeM2:
			size === undefined ? undefined : Math.round(toSquareMeters(size)),
		layout: valid.layout,
		status: parseEnum(
			"queue",
			valid.id,
			"status",
			valid.status,
			OFFER_STATUSES,
		),
		fetchedAt: valid.fetched_at,
	};
}
