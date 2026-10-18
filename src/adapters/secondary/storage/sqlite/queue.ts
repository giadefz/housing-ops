import type Database from "better-sqlite3";
import { z } from "zod";
import { toSquareMeters } from "../../../../core/domain/dwelling.js";
import {
	MARKET_STATUSES,
	USER_STATUSES,
} from "../../../../core/domain/decision.js";
import type { QueueView } from "../../../../core/domain/queue.js";
import type {
	OfferSummary,
	QueueViewQuery,
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
	status: z.string().nullable(),
	user_status: z.string(),
	fetched_at: z.string(),
	address: z.string(),
	size: z.string().nullable(),
	rooms: z.string().nullable(),
	layout: z.string(),
});

const SUMMARY_COLUMNS = `o.id AS id, o.provider AS provider, o.price AS price,
	dec.market_status AS status, COALESCE(dec.user_status, 'none') AS user_status,
	o.fetched_at AS fetched_at,
	d.address AS address, d.size AS size, d.rooms AS rooms, d.layout AS layout`;

/** The to-evaluate view: feed entries not judged yet (a reaction is not a judgment). */
const TO_EVALUATE_SQL = `SELECT ${SUMMARY_COLUMNS}
	FROM feed f
	JOIN offers o ON o.id = f.offer_id
	JOIN dwellings d ON d.id = o.dwelling_id
	LEFT JOIN decisions dec
		ON dec.member_id = f.member_id AND dec.offer_id = f.offer_id
	WHERE f.member_id = ? AND f.state = 'to-evaluate' AND dec.market_status IS NULL
	ORDER BY f.added_at DESC, f.offer_id DESC LIMIT ?`;

/** A judged view: every decision in the requested market status. */
const JUDGED_SQL = `SELECT ${SUMMARY_COLUMNS}
	FROM decisions dec JOIN offers o ON o.id = dec.offer_id
	JOIN dwellings d ON d.id = o.dwelling_id
	WHERE dec.member_id = ? AND dec.market_status = ?
	ORDER BY o.fetched_at, o.id LIMIT ?`;

/** Lists one page of a member's queue view. */
export function listQueue(
	database: Database.Database,
	memberId: string,
	query: QueueViewQuery,
): OfferSummary[] {
	const records: unknown[] =
		query.view === "to-evaluate"
			? database.prepare(TO_EVALUATE_SQL).all(memberId, query.limit)
			: database
					.prepare(JUDGED_SQL)
					.all(memberId, query.view, query.limit);
	return records.map((record) => toSummary(record));
}

/** Counts a member's offers in one queue view. */
export function countQueue(
	database: Database.Database,
	memberId: string,
	view: QueueView,
): number {
	const record: unknown =
		view === "to-evaluate"
			? database
					.prepare(
						`SELECT COUNT(*) AS count FROM feed f
						LEFT JOIN decisions dec
							ON dec.member_id = f.member_id AND dec.offer_id = f.offer_id
						WHERE f.member_id = ? AND f.state = 'to-evaluate' AND dec.market_status IS NULL`,
					)
					.get(memberId)
			: database
					.prepare(
						"SELECT COUNT(*) AS count FROM decisions WHERE member_id = ? AND market_status = ?",
					)
					.get(memberId, view);
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
	const marketStatus =
		valid.status === null
			? undefined
			: parseEnum(
					"queue",
					valid.id,
					"status",
					valid.status,
					MARKET_STATUSES,
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
		userStatus: parseEnum(
			"queue",
			valid.id,
			"user_status",
			valid.user_status,
			USER_STATUSES,
		),
		fetchedAt: valid.fetched_at,
		...(marketStatus === undefined ? {} : { marketStatus }),
	};
}
