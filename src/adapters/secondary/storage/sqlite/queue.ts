import type Database from "better-sqlite3";
import { z } from "zod";
import { toSquareMeters } from "../../../../core/domain/dwelling.js";
import {
	MARKET_STATUSES,
	USER_STATUSES,
} from "../../../../core/domain/offer.js";
import type { MarketStatus } from "../../../../core/domain/offer.js";
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
	user_status: z.string(),
	fetched_at: z.string(),
	address: z.string(),
	size: z.string().nullable(),
	rooms: z.string().nullable(),
	layout: z.string(),
});

/** Queue projection over offers joined to their dwelling. Compact records only. */
export function listQueue(
	database: Database.Database,
	status: MarketStatus,
	limit: number,
): OfferSummary[] {
	const records: unknown[] = database
		.prepare(
			`SELECT o.id AS id, o.provider AS provider, o.price AS price, o.status AS status,
			o.user_status AS user_status, o.fetched_at AS fetched_at,
			d.address AS address, d.size AS size, d.rooms AS rooms, d.layout AS layout
			FROM offers o JOIN dwellings d ON d.id = o.dwelling_id
			WHERE o.status = ? ORDER BY o.fetched_at LIMIT ?`,
		)
		.all(status, limit);
	return records.map((record) => toSummary(record));
}

/** Counts offers with the given market status. */
export function countOffersByStatus(
	database: Database.Database,
	status: MarketStatus,
): number {
	const record: unknown = database
		.prepare("SELECT COUNT(*) AS count FROM offers WHERE status = ?")
		.get(status);
	return countOf(record);
}

function countOf(record: unknown): number {
	if (
		typeof record === "object" &&
		record !== null &&
		"count" in record &&
		typeof record.count === "number"
	) {
		return record.count;
	}
	return 0;
}

interface StoredPrice {
	amount: number;
	currency: string;
}

export function toSummary(record: unknown): OfferSummary {
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
		marketStatus: parseEnum(
			"queue",
			valid.id,
			"status",
			valid.status,
			MARKET_STATUSES,
		),
		userStatus: parseEnum(
			"queue",
			valid.id,
			"user_status",
			valid.user_status,
			USER_STATUSES,
		),
		fetchedAt: valid.fetched_at,
	};
}
