import type Database from "better-sqlite3";
import type { FeedCursor } from "../../../../core/domain/feed.js";
import type { TableDefinition } from "./migrate.js";

/** Feed cursor table. One member's place in the pool while filling the feed. */
export const feedCursorTable: TableDefinition = {
	table: "feed_cursor",
	dependsOn: ["members"],
	createTable: `
CREATE TABLE feed_cursor (
	member_id TEXT PRIMARY KEY REFERENCES members(id),
	entered_at TEXT NOT NULL,
	offer_id TEXT NOT NULL
);`,
};

interface FeedCursorRow {
	member_id: string;
	entered_at: string;
	offer_id: string;
}

/** Reads a member's pool bookmark, or null when they have not filled yet. */
export async function findFeedCursor(
	database: Database.Database,
	memberId: string,
): Promise<FeedCursor | null> {
	const row = database
		.prepare(
			"SELECT member_id, entered_at, offer_id FROM feed_cursor WHERE member_id = ?",
		)
		.get(memberId) as FeedCursorRow | undefined;
	return row === undefined ? null : toCursor(row);
}

/** Writes a member's pool bookmark, replacing the previous one. */
export async function saveFeedCursor(
	database: Database.Database,
	cursor: FeedCursor,
): Promise<void> {
	database
		.prepare(
			`INSERT INTO feed_cursor (member_id, entered_at, offer_id)
			VALUES (?, ?, ?)
			ON CONFLICT(member_id) DO UPDATE SET
			entered_at = excluded.entered_at, offer_id = excluded.offer_id`,
		)
		.run(cursor.memberId, cursor.enteredAt, cursor.offerId);
}

/** Clears a member's pool bookmark. Synchronous core of deleteFeedCursor. */
export function deleteFeedCursorSync(
	database: Database.Database,
	memberId: string,
): void {
	database
		.prepare("DELETE FROM feed_cursor WHERE member_id = ?")
		.run(memberId);
}

/** Clears a member's pool bookmark. */
export async function deleteFeedCursor(
	database: Database.Database,
	memberId: string,
): Promise<void> {
	deleteFeedCursorSync(database, memberId);
}

function toCursor(row: FeedCursorRow): FeedCursor {
	return {
		memberId: row.member_id,
		enteredAt: row.entered_at,
		offerId: row.offer_id,
	};
}
