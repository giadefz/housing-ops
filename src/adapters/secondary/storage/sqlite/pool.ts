import type Database from "better-sqlite3";
import { MARKET_STATUSES } from "../../../../core/domain/decision.js";
import type { Offer, OfferVersion } from "../../../../core/domain/offer.js";
import type {
	PoolBatchQuery,
	PoolCandidate,
} from "../../../../core/ports/store.port.js";
import { toDwelling } from "./dwelling.js";
import type { TableDefinition } from "./migrate.js";
import { toStoredOffer } from "./offer.js";
import { listVersionsForOffers } from "./offer-version.js";
import { parseEnum } from "./record.js";

/** Pool table. The shared, durable set of offers that passed the pool filter. */
export const poolTable: TableDefinition = {
	table: "pool",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE pool (
	offer_id TEXT PRIMARY KEY REFERENCES offers(id),
	entered_at TEXT NOT NULL
);
CREATE INDEX pool_entered ON pool(entered_at DESC, offer_id DESC);`,
};

interface PoolJoinRow {
	id: string;
	dwelling_id: string;
	provider: string;
	listing_id: string;
	url: string;
	market: string;
	price: string;
	images: string;
	description: string;
	posted_at: string | null;
	fetched_at: string;
	d_id: string;
	d_address_key: string;
	d_address: string;
	d_size: string | null;
	d_rooms: string | null;
	d_layout: string;
	d_year_built: number | null;
	d_floor: number | null;
	d_floors_total: number | null;
	d_attributes: string;
	entered_at: string;
	market_status: string | null;
	feed_offer_id: string | null;
}

const SELECT_COLUMNS = `o.id AS id, o.dwelling_id AS dwelling_id,
	o.provider AS provider, o.listing_id AS listing_id, o.url AS url,
	o.market AS market, o.price AS price, o.images AS images,
	o.description AS description, o.posted_at AS posted_at,
	o.fetched_at AS fetched_at,
	d.id AS d_id, d.address_key AS d_address_key, d.address AS d_address,
	d.size AS d_size, d.rooms AS d_rooms, d.layout AS d_layout,
	d.year_built AS d_year_built, d.floor AS d_floor,
	d.floors_total AS d_floors_total, d.attributes AS d_attributes,
	p.entered_at AS entered_at, dec.market_status AS market_status,
	f.offer_id AS feed_offer_id`;

const JOINS = `FROM pool p
	JOIN offers o ON o.id = p.offer_id
	JOIN dwellings d ON d.id = o.dwelling_id
	LEFT JOIN decisions dec
		ON dec.member_id = ? AND dec.offer_id = p.offer_id
	LEFT JOIN feed f
		ON f.member_id = ? AND f.offer_id = p.offer_id`;

const FIRST_BATCH_SQL = `SELECT ${SELECT_COLUMNS}
	${JOINS}
	ORDER BY p.entered_at DESC, p.offer_id DESC
	LIMIT ?`;

const BATCH_SQL = `SELECT ${SELECT_COLUMNS}
	${JOINS}
	WHERE p.entered_at < ? OR (p.entered_at = ? AND p.offer_id < ?)
	ORDER BY p.entered_at DESC, p.offer_id DESC
	LIMIT ?`;

/** Adds an offer to the pool and returns its stored entry time. */
export async function addToPool(
	database: Database.Database,
	offerId: string,
	enteredAt: string,
): Promise<string> {
	database
		.prepare(
			"INSERT OR IGNORE INTO pool (offer_id, entered_at) VALUES (?, ?)",
		)
		.run(offerId, enteredAt);
	const row = database
		.prepare("SELECT entered_at FROM pool WHERE offer_id = ?")
		.get(offerId) as { entered_at: string };
	return row.entered_at;
}

/** Lists one bounded batch of pool candidates below a member's cursor. */
export async function listPoolBatch(
	database: Database.Database,
	query: PoolBatchQuery,
): Promise<PoolCandidate[]> {
	const rows = (
		query.cursor === null
			? database
					.prepare(FIRST_BATCH_SQL)
					.all(query.memberId, query.memberId, query.limit)
			: database
					.prepare(BATCH_SQL)
					.all(
						query.memberId,
						query.memberId,
						query.cursor.enteredAt,
						query.cursor.enteredAt,
						query.cursor.offerId,
						query.limit,
					)
	) as PoolJoinRow[];
	const versions = listVersionsForOffers(
		database,
		rows.map((row) => row.id),
	);
	return rows.map((row) => toCandidate(row, versions));
}

function toCandidate(
	row: PoolJoinRow,
	versions: Map<string, OfferVersion[]>,
): PoolCandidate {
	const offer: Offer = {
		...toStoredOffer(offerRecord(row)),
		versions: versions.get(row.id) ?? [],
	};
	const marketStatus = parseMarketStatus(row.id, row.market_status);
	return {
		offer,
		dwelling: toDwelling(dwellingRecord(row)),
		enteredAt: row.entered_at,
		inFeed: row.feed_offer_id !== null,
		...(marketStatus === undefined ? {} : { marketStatus }),
	};
}

function parseMarketStatus(
	offerId: string,
	value: string | null,
): PoolCandidate["marketStatus"] {
	if (value === null) return undefined;
	return parseEnum("pool", offerId, "market_status", value, MARKET_STATUSES);
}

function offerRecord(row: PoolJoinRow): unknown {
	return {
		id: row.id,
		dwelling_id: row.dwelling_id,
		provider: row.provider,
		listing_id: row.listing_id,
		url: row.url,
		market: row.market,
		price: row.price,
		images: row.images,
		description: row.description,
		posted_at: row.posted_at,
		fetched_at: row.fetched_at,
	};
}

function dwellingRecord(row: PoolJoinRow): unknown {
	return {
		id: row.d_id,
		address_key: row.d_address_key,
		address: row.d_address,
		size: row.d_size,
		rooms: row.d_rooms,
		layout: row.d_layout,
		year_built: row.d_year_built,
		floor: row.d_floor,
		floors_total: row.d_floors_total,
		attributes: row.d_attributes,
	};
}
