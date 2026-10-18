import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
	closeStore,
	createSqliteStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import type { FeedEntry } from "../src/core/domain/feed.js";
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";
import type { Offer } from "../src/core/domain/offer.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

const MEMBER = DEFAULT_MEMBER_ID;

function testStore(): {
	database: Database.Database;
	store: ReturnType<typeof createSqliteStore>;
} {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	const database = openStore(path.join(root, "housing.db"));
	cleanups.push(() => {
		closeStore(database);
		fs.rmSync(root, { recursive: true, force: true });
	});
	return { database, store: createSqliteStore(database) };
}

function dwellingFixture(): Dwelling {
	return {
		id: "dw-1",
		addressKey: "12 main street dublin 8|d08ab12",
		address: { freeText: "12 Main Street, Dublin 8" },
		size: { value: 85, unit: "m2" },
		rooms: { bedrooms: 2 },
		layout: "apartment",
		attributes: { ber: "B" },
	};
}

function offerFixture(id: string): Offer {
	return {
		id,
		dwellingId: "dw-1",
		provider: "daft",
		listingId: id,
		url: `https://example.invalid/${id}`,
		market: "rent",
		price: { amount: 2000, currency: "EUR", period: "month" },
		images: [],
		description: "Bright apartment",
		fetchedAt: "2026-10-04T00:00:00.000Z",
		versions: [
			{
				version: 1,
				fetchedAt: "2026-10-04T00:00:00.000Z",
				price: { amount: 2000, currency: "EUR", period: "month" },
				payload: {},
			},
		],
	};
}

async function seed(
	store: ReturnType<typeof createSqliteStore>,
	offers: Array<{ id: string; enteredAt: string }>,
): Promise<void> {
	await store.saveDwelling(dwellingFixture());
	for (const offer of offers) {
		await store.saveOffer(offerFixture(offer.id));
		await store.addToPool(offer.id, offer.enteredAt);
	}
}

function feedEntry(offerId: string): FeedEntry {
	return {
		memberId: MEMBER,
		offerId,
		addedAt: "2026-10-04T00:00:00.000Z",
		state: "to-evaluate",
	};
}

describe("feed cursor", () => {
	it("saves, replaces, finds, and deletes a cursor", async () => {
		const { store } = testStore();
		expect(await store.findFeedCursor(MEMBER)).toBeNull();
		await store.saveFeedCursor({
			memberId: MEMBER,
			enteredAt: "2026-10-02T00:00:00.000Z",
			offerId: "o2",
		});
		expect(await store.findFeedCursor(MEMBER)).toEqual({
			memberId: MEMBER,
			enteredAt: "2026-10-02T00:00:00.000Z",
			offerId: "o2",
		});
		await store.saveFeedCursor({
			memberId: MEMBER,
			enteredAt: "2026-10-01T00:00:00.000Z",
			offerId: "o1",
		});
		expect((await store.findFeedCursor(MEMBER))?.offerId).toBe("o1");
		await store.deleteFeedCursor(MEMBER);
		expect(await store.findFeedCursor(MEMBER)).toBeNull();
	});
});

describe("listPoolBatch", () => {
	it("lists pool rows newest first below the cursor", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "o1", enteredAt: "2026-10-01T00:00:00.000Z" },
			{ id: "o2", enteredAt: "2026-10-02T00:00:00.000Z" },
			{ id: "o3", enteredAt: "2026-10-03T00:00:00.000Z" },
		]);
		const first = await store.listPoolBatch({
			memberId: MEMBER,
			cursor: null,
			limit: 2,
		});
		expect(first.map((candidate) => candidate.offer.id)).toEqual([
			"o3",
			"o2",
		]);
		const next = await store.listPoolBatch({
			memberId: MEMBER,
			cursor: {
				memberId: MEMBER,
				enteredAt: "2026-10-02T00:00:00.000Z",
				offerId: "o2",
			},
			limit: 2,
		});
		expect(next.map((candidate) => candidate.offer.id)).toEqual(["o1"]);
	});

	it("carries judgment, feed membership, and assembled offer and dwelling", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "o1", enteredAt: "2026-10-01T00:00:00.000Z" },
			{ id: "o2", enteredAt: "2026-10-02T00:00:00.000Z" },
		]);
		await store.saveDecision({
			memberId: MEMBER,
			offerId: "o2",
			marketStatus: "screened",
			userStatus: "none",
		});
		await store.addToFeed(feedEntry("o1"));
		const batch = await store.listPoolBatch({
			memberId: MEMBER,
			cursor: null,
			limit: 10,
		});
		const byId = new Map(
			batch.map((candidate) => [candidate.offer.id, candidate]),
		);
		expect(byId.get("o2")?.marketStatus).toBe("screened");
		expect(byId.get("o1")?.marketStatus).toBeUndefined();
		expect(byId.get("o1")?.inFeed).toBe(true);
		expect(byId.get("o2")?.inFeed).toBe(false);
		expect(byId.get("o2")?.offer.versions).toHaveLength(1);
		expect(byId.get("o2")?.dwelling.address.freeText).toBe(
			"12 Main Street, Dublin 8",
		);
	});

	it("orders equal entry times by offer id descending", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "o1", enteredAt: "2026-10-01T00:00:00.000Z" },
			{ id: "o2", enteredAt: "2026-10-01T00:00:00.000Z" },
		]);
		const batch = await store.listPoolBatch({
			memberId: MEMBER,
			cursor: null,
			limit: 10,
		});
		expect(batch.map((candidate) => candidate.offer.id)).toEqual([
			"o2",
			"o1",
		]);
	});

	it("keeps the first entry time when an offer re-enters the pool", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "o1", enteredAt: "2026-10-01T00:00:00.000Z" },
		]);
		expect(await store.addToPool("o1", "2026-10-05T00:00:00.000Z")).toBe(
			"2026-10-01T00:00:00.000Z",
		);
	});
});

describe("feed counts", () => {
	it("counts the feed, splits judged, and clears it", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "o1", enteredAt: "2026-10-01T00:00:00.000Z" },
			{ id: "o2", enteredAt: "2026-10-02T00:00:00.000Z" },
		]);
		await store.addToFeed(feedEntry("o1"));
		await store.addToFeed(feedEntry("o2"));
		await store.saveDecision({
			memberId: MEMBER,
			offerId: "o1",
			marketStatus: "screened",
			userStatus: "none",
		});
		expect(await store.countFeed(MEMBER)).toBe(2);
		expect(await store.countUnjudged(MEMBER)).toBe(1);
		await store.clearFeed(MEMBER);
		expect(await store.countFeed(MEMBER)).toBe(0);
	});
});
