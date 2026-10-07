import type Database from "better-sqlite3";
import type {
	DigestData,
	FeatureCount,
	OfferSummary,
} from "../../../../core/ports/store.port.js";
import { toSummary } from "./queue.js";

const FAVORITED =
	"(SELECT offer_id FROM interactions WHERE action = 'favorited')";

/** Gathers every aggregate the profile digest needs, at call time. */
export function loadDigest(database: Database.Database): DigestData {
	return {
		favorited: favoritedSummaries(database),
		rejectedCount: scalar(
			database,
			"SELECT COUNT(*) AS n FROM interactions WHERE action = 'rejected'",
		),
		rejectedReasons: featureCounts(
			database,
			`SELECT reason AS value, COUNT(*) AS n FROM interactions
			WHERE action = 'rejected' AND reason IS NOT NULL
			GROUP BY reason ORDER BY n DESC`,
		),
		allPrices: priceAmounts(database),
		offerCount: scalar(database, "SELECT COUNT(*) AS n FROM offers"),
		viewedCount: scalar(
			database,
			"SELECT COUNT(*) AS n FROM interactions WHERE action = 'viewed'",
		),
		layouts: featureCounts(database, featureQuery("d.layout")),
		bedrooms: featureCounts(
			database,
			featureQuery("json_extract(d.rooms, '$.bedrooms')"),
		),
		ber: featureCounts(
			database,
			featureQuery("json_extract(d.attributes, '$.ber')"),
		),
	};
}

function favoritedSummaries(database: Database.Database): OfferSummary[] {
	const records: unknown[] = database
		.prepare(
			`SELECT o.id AS id, o.provider AS provider, o.price AS price, o.status AS status, o.fetched_at AS fetched_at,
			d.address AS address, d.size AS size, d.rooms AS rooms, d.layout AS layout
			FROM offers o JOIN dwellings d ON d.id = o.dwelling_id
			WHERE o.id IN ${FAVORITED} ORDER BY o.fetched_at DESC`,
		)
		.all();
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
): FeatureCount[] {
	const records: unknown[] = database.prepare(sql).all();
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

function scalar(database: Database.Database, sql: string): number {
	const record: unknown = database.prepare(sql).get();
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

function priceAmounts(database: Database.Database): number[] {
	const records: unknown[] = database
		.prepare("SELECT price FROM offers")
		.all();
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
