import type Database from "better-sqlite3";
import type {
	DigestData,
	FeatureCount,
	OfferSummary,
} from "../../../../core/ports/store.port.js";
import { toSummary } from "./queue.js";

const FAVORITED =
	"(SELECT offer_id FROM interactions WHERE member_id = ? AND action = 'favorited')";

/** Gathers every aggregate the profile digest needs, at call time. */
export function loadDigest(
	database: Database.Database,
	memberId: string,
): DigestData {
	return {
		favorited: favoritedSummaries(database, memberId),
		rejectedCount: scalar(
			database,
			"SELECT COUNT(*) AS n FROM interactions WHERE member_id = ? AND action = 'rejected'",
			memberId,
		),
		rejectedReasons: featureCounts(
			database,
			`SELECT reason AS value, COUNT(*) AS n FROM interactions
			WHERE member_id = ? AND action = 'rejected' AND reason IS NOT NULL
			GROUP BY reason ORDER BY n DESC`,
			memberId,
		),
		allPrices: priceAmounts(database, memberId),
		offerCount: scalar(
			database,
			"SELECT COUNT(*) AS n FROM decisions WHERE member_id = ?",
			memberId,
		),
		viewedCount: scalar(
			database,
			"SELECT COUNT(*) AS n FROM interactions WHERE member_id = ? AND action = 'viewed'",
			memberId,
		),
		layouts: featureCounts(database, featureQuery("d.layout"), memberId),
		bedrooms: featureCounts(
			database,
			featureQuery("json_extract(d.rooms, '$.bedrooms')"),
			memberId,
		),
		ber: featureCounts(
			database,
			featureQuery("json_extract(d.attributes, '$.ber')"),
			memberId,
		),
	};
}

function favoritedSummaries(
	database: Database.Database,
	memberId: string,
): OfferSummary[] {
	const records: unknown[] = database
		.prepare(
			`SELECT o.id AS id, o.provider AS provider, o.price AS price, dec.market_status AS status,
			dec.user_status AS user_status, o.fetched_at AS fetched_at,
			d.address AS address, d.size AS size, d.rooms AS rooms, d.layout AS layout
			FROM decisions dec JOIN offers o ON o.id = dec.offer_id
			JOIN dwellings d ON d.id = o.dwelling_id
			WHERE dec.member_id = ? AND o.id IN ${FAVORITED}
			ORDER BY o.fetched_at DESC`,
		)
		.all(memberId, memberId);
	return records.map((record) => toSummary(record));
}

function featureQuery(expression: string): string {
	return `SELECT ${expression} AS value, COUNT(*) AS n
		FROM offers o JOIN dwellings d ON d.id = o.dwelling_id
		WHERE o.id IN ${FAVORITED} AND ${expression} IS NOT NULL
		GROUP BY value ORDER BY n DESC`;
}

function featureCounts(
	database: Database.Database,
	sql: string,
	memberId: string,
): FeatureCount[] {
	const records: unknown[] = database.prepare(sql).all(memberId);
	return records.flatMap((record) => {
		if (
			typeof record !== "object" ||
			record === null ||
			!("value" in record) ||
			!("n" in record) ||
			record.value === null ||
			typeof record.n !== "number"
		) {
			return [];
		}
		return [{ value: String(record.value), count: record.n }];
	});
}

function scalar(
	database: Database.Database,
	sql: string,
	memberId: string,
): number {
	const record: unknown = database.prepare(sql).get(memberId);
	if (
		typeof record === "object" &&
		record !== null &&
		"n" in record &&
		typeof record.n === "number"
	) {
		return record.n;
	}
	return 0;
}

function priceAmounts(database: Database.Database, memberId: string): number[] {
	const records: unknown[] = database
		.prepare(
			"SELECT o.price AS price FROM offers o JOIN decisions d ON d.offer_id = o.id WHERE d.member_id = ?",
		)
		.all(memberId);
	return records.flatMap((record) => {
		const amount = amountFrom(record);
		return amount === null ? [] : [amount];
	});
}

function amountFrom(record: unknown): number | null {
	if (
		typeof record !== "object" ||
		record === null ||
		!("price" in record) ||
		typeof record.price !== "string"
	) {
		return null;
	}
	try {
		const parsed = JSON.parse(record.price) as { amount?: unknown };
		return typeof parsed.amount === "number" ? parsed.amount : null;
	} catch {
		return null;
	}
}
