import type Database from "better-sqlite3";
import { z } from "zod";
import { toSquareMeters } from "../../../../core/domain/dwelling.js";
import {
	MARKET_STATUSES,
	USER_STATUSES,
	type MarketStatus,
} from "../../../../core/domain/decision.js";
import type {
	OfferStatusQuery,
	OfferSummary,
} from "../../../../core/ports/store.port.js";
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

/** Queue projection over a member's decisions joined to their offer's dwelling. */
export function listQueue(
	database: Database.Database,
	memberId: string,
	query: OfferStatusQuery,
): OfferSummary[] {
	const records: unknown[] = database
		.prepare(
			`SELECT o.id AS id, o.provider AS provider, o.price AS price, dec.market_status AS status,
			dec.user_status AS user_status, o.fetched_at AS fetched_at,
			d.address AS address, d.size AS size, d.rooms AS rooms, d.layout AS layout
			FROM decisions dec JOIN offers o ON o.id = dec.offer_id
			JOIN dwellings d ON d.id = o.dwelling_id
			WHERE dec.member_id = ? AND dec.market_status = ? ORDER BY o.fetched_at LIMIT ?`,
		)
		.all(memberId, query.status, query.limit);
	return records.map((record) => toSummary(record));
}

/** Counts a member's offers with the given market status. */
export function countOffersByStatus(
	database: Database.Database,
	memberId: string,
	status: MarketStatus,
): number {
	const record: unknown = database
		.prepare(
			"SELECT COUNT(*) AS count FROM decisions WHERE member_id = ? AND market_status = ?",
		)
		.get(memberId, status);
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

/** The price shape as stored in the offers table. */
interface StoredPrice {
	amount: number;
	currency: string;
}

/** Projects one queue record into a compact offer summary, or throws when malformed. */
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
