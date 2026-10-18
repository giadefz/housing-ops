import type Database from "better-sqlite3";
import { FEED_STATES, type FeedEntry } from "../../../../core/domain/feed.js";
import type { TableDefinition } from "./migrate.js";
import { parseEnum } from "./record.js";

interface FeedRow {
	member_id: string;
	offer_id: string;
	added_at: string;
	state: string;
}

/** Feed table. One member's disposable filter result over the pool. */
export const feedTable: TableDefinition = {
	table: "feed",
	dependsOn: ["members", "offers"],
	createTable: `
CREATE TABLE feed (
	member_id TEXT NOT NULL REFERENCES members(id),
	offer_id TEXT NOT NULL REFERENCES offers(id),
	added_at TEXT NOT NULL,
	state TEXT NOT NULL,
	PRIMARY KEY (member_id, offer_id)
);`,
};

/** Adds an offer to a member's feed. Idempotent: a re-seen offer keeps its first entry. */
export async function addToFeed(
	database: Database.Database,
	entry: FeedEntry,
): Promise<void> {
	database
		.prepare(
			`INSERT OR IGNORE INTO feed (member_id, offer_id, added_at, state)
			VALUES (?, ?, ?, ?)`,
		)
		.run(entry.memberId, entry.offerId, entry.addedAt, entry.state);
}

/** Reads one member's feed entry for an offer, or null when the offer is not in their feed. */
export async function findFeedEntry(
	database: Database.Database,
	memberId: string,
	offerId: string,
): Promise<FeedEntry | null> {
	const row = database
		.prepare(
			`SELECT member_id, offer_id, added_at, state FROM feed
			WHERE member_id = ? AND offer_id = ?`,
		)
		.get(memberId, offerId) as FeedRow | undefined;
	return row === undefined ? null : toEntry(row);
}

/** Lists a member's feed entries, newest first, capped by a limit. */
export async function listFeedEntries(
	database: Database.Database,
	memberId: string,
	limit: number,
): Promise<FeedEntry[]> {
	const rows = database
		.prepare(
			`SELECT member_id, offer_id, added_at, state FROM feed
			WHERE member_id = ? ORDER BY added_at DESC, offer_id DESC LIMIT ?`,
		)
		.all(memberId, limit) as FeedRow[];
	return rows.map(toEntry);
}

function toEntry(row: FeedRow): FeedEntry {
	return {
		memberId: row.member_id,
		offerId: row.offer_id,
		addedAt: row.added_at,
		state: parseEnum("feed", row.offer_id, "state", row.state, FEED_STATES),
	};
}

/** Deletes every entry in a member's feed. Synchronous core of clearFeed. */
export function clearFeedSync(
	database: Database.Database,
	memberId: string,
): void {
	database.prepare("DELETE FROM feed WHERE member_id = ?").run(memberId);
}

/** Deletes every entry in a member's feed. */
export async function clearFeed(
	database: Database.Database,
	memberId: string,
): Promise<void> {
	clearFeedSync(database, memberId);
}

/** Counts every offer in a member's feed. */
export async function countFeed(
	database: Database.Database,
	memberId: string,
): Promise<number> {
	const record: unknown = database
		.prepare("SELECT COUNT(*) AS count FROM feed WHERE member_id = ?")
		.get(memberId);
	return countOf(record);
}

/** Counts the feed offers a member has not judged yet (a reaction is not a judgment). */
export async function countUnjudged(
	database: Database.Database,
	memberId: string,
): Promise<number> {
	const record: unknown = database
		.prepare(
			`SELECT COUNT(*) AS count FROM feed f
			LEFT JOIN decisions d
				ON d.member_id = f.member_id AND d.offer_id = f.offer_id
			WHERE f.member_id = ? AND d.market_status IS NULL`,
		)
		.get(memberId);
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
