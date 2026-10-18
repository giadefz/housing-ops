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
import type { PipelineEvent } from "../src/core/domain/events.js";
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";
import type { Offer } from "../src/core/domain/offer.js";
import { budgetFilter } from "../src/core/filters/budget.js";
import type { EventBus } from "../src/core/ports/event-bus.port.js";
import type { Profile } from "../src/core/schemas/profile.js";
import {
	emptyFeed,
	fillFeed,
	getFeedStatus,
	type FillFeedRequest,
} from "../src/core/services/feed.service.js";
import type { FilterStage } from "../src/core/services/pipeline.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

const silentBus: EventBus = { on() {}, async emit() {} };
const budgetStage: FilterStage = { filter: budgetFilter, missing: "fail" };
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

function offerFixture(id: string, amount: number): Offer {
	return {
		id,
		dwellingId: "dw-1",
		provider: "daft",
		listingId: id,
		url: `https://example.invalid/${id}`,
		market: "rent",
		price: { amount, currency: "EUR", period: "month" },
		images: [],
		description: "Bright apartment",
		fetchedAt: "2026-10-04T00:00:00.000Z",
		versions: [],
	};
}

interface SeededOffer {
	id: string;
	enteredAt: string;
	amount?: number;
}

async function seed(
	store: ReturnType<typeof createSqliteStore>,
	offers: SeededOffer[],
): Promise<void> {
	await store.saveDwelling(dwellingFixture());
	for (const offer of offers) {
		await store.saveOffer(offerFixture(offer.id, offer.amount ?? 2000));
		await store.addToPool(offer.id, offer.enteredAt);
	}
}

function profile(overrides: Partial<Profile> = {}): Profile {
	return {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: true,
		recheckHours: 48,
		feed: { target: 2, batch: 2 },
		...overrides,
	};
}

function fillRequest(
	store: ReturnType<typeof createSqliteStore>,
	overrides: Partial<FillFeedRequest> = {},
): FillFeedRequest {
	return {
		store,
		events: silentBus,
		profile: profile(),
		filters: [budgetStage],
		memberId: MEMBER,
		...overrides,
	};
}

async function feedIds(
	store: ReturnType<typeof createSqliteStore>,
): Promise<string[]> {
	const feed = await store.listFeedOffers(MEMBER, 100);
	return feed.map((entry) => entry.offer.id).sort();
}

const POOL = [
	{ id: "older", enteredAt: "2026-10-01T00:00:00.000Z" },
	{ id: "middle", enteredAt: "2026-10-02T00:00:00.000Z" },
	{ id: "newest", enteredAt: "2026-10-03T00:00:00.000Z" },
];

describe("fillFeed", () => {
	it("fills with the newest passing pool rows up to the target", async () => {
		const { store } = testStore();
		await seed(store, POOL);
		const result = await fillFeed(fillRequest(store));
		expect(result).toEqual({
			added: 2,
			unjudged: 2,
			total: 2,
			judged: 0,
			hasMore: false,
		});
		expect(await feedIds(store)).toEqual(["middle", "newest"]);
	});

	it("skips judged offers and resumes below the cursor", async () => {
		const { store } = testStore();
		await seed(store, POOL);
		await store.saveDecision({
			memberId: MEMBER,
			offerId: "newest",
			marketStatus: "screened",
			userStatus: "none",
		});
		const first = await fillFeed(fillRequest(store));
		expect(first).toMatchObject({ added: 1, unjudged: 1, hasMore: true });
		const second = await fillFeed(fillRequest(store));
		expect(second).toMatchObject({ added: 1, unjudged: 2, hasMore: false });
		expect(await feedIds(store)).toEqual(["middle", "older"]);
		expect(await feedIds(store)).not.toContain("newest");
	});

	it("advances the cursor when a whole batch is skipped", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "o1", enteredAt: "2026-10-01T00:00:00.000Z" },
			{ id: "o2", enteredAt: "2026-10-02T00:00:00.000Z" },
		]);
		for (const offerId of ["o1", "o2"])
			await store.saveDecision({
				memberId: MEMBER,
				offerId,
				marketStatus: "screened",
				userStatus: "none",
			});
		const settings = profile({ feed: { target: 2, batch: 1 } });
		const first = await fillFeed(fillRequest(store, { profile: settings }));
		expect(first).toMatchObject({ added: 0, unjudged: 0, hasMore: true });
		const second = await fillFeed(
			fillRequest(store, { profile: settings }),
		);
		expect(second).toMatchObject({ added: 0, unjudged: 0, hasMore: true });
		const third = await fillFeed(fillRequest(store, { profile: settings }));
		expect(third).toMatchObject({ added: 0, unjudged: 0, hasMore: false });
	});

	it("does not treat a reaction as a judgment", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "o1", enteredAt: "2026-10-01T00:00:00.000Z" },
		]);
		await store.saveDecision({
			memberId: MEMBER,
			offerId: "o1",
			userStatus: "favorited",
		});
		const result = await fillFeed(
			fillRequest(store, {
				profile: profile({ feed: { target: 1, batch: 10 } }),
			}),
		);
		expect(result).toMatchObject({ added: 1, unjudged: 1 });
	});

	it("skips offers already in the feed", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "older", enteredAt: "2026-10-01T00:00:00.000Z" },
			{ id: "newest", enteredAt: "2026-10-02T00:00:00.000Z" },
		]);
		await store.addToFeed({
			memberId: MEMBER,
			offerId: "newest",
			addedAt: "2026-10-02T00:00:00.000Z",
			state: "accepted",
		});
		const result = await fillFeed(fillRequest(store));
		expect(result).toMatchObject({ added: 1, unjudged: 2, total: 2 });
		expect(await feedIds(store)).toEqual(["newest", "older"]);
	});

	it("never re-adds a judged offer after emptying", async () => {
		const { store } = testStore();
		await seed(store, POOL);
		await fillFeed(fillRequest(store));
		await store.saveDecision({
			memberId: MEMBER,
			offerId: "middle",
			marketStatus: "screened",
			userStatus: "none",
		});
		const emptied = await emptyFeed({ store, memberId: MEMBER });
		expect(emptied).toEqual({ total: 0, unjudged: 0, judged: 0 });
		expect(await store.findFeedCursor(MEMBER)).toBeNull();
		expect(await store.findDecision(MEMBER, "middle")).not.toBeNull();
		const refill = await fillFeed(fillRequest(store));
		expect(refill).toMatchObject({ added: 1, unjudged: 1, hasMore: true });
		const rest = await fillFeed(fillRequest(store));
		expect(rest).toMatchObject({ added: 1, unjudged: 2, hasMore: false });
		expect(await feedIds(store)).toEqual(["newest", "older"]);
		expect(await feedIds(store)).not.toContain("middle");
	});

	it("reports no more work when the pool is exhausted", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "older", enteredAt: "2026-10-01T00:00:00.000Z" },
		]);
		const result = await fillFeed(
			fillRequest(store, {
				profile: profile({ feed: { target: 5, batch: 10 } }),
			}),
		);
		expect(result).toEqual({
			added: 1,
			unjudged: 1,
			total: 1,
			judged: 0,
			hasMore: false,
		});
	});

	it("does not add offers the member filter rejects", async () => {
		const { store } = testStore();
		await seed(store, [
			{
				id: "pricey",
				enteredAt: "2026-10-01T00:00:00.000Z",
				amount: 3000,
			},
		]);
		const result = await fillFeed(
			fillRequest(store, {
				profile: profile({ feed: { target: 2, batch: 10 } }),
			}),
		);
		expect(result).toEqual({
			added: 0,
			unjudged: 0,
			total: 0,
			judged: 0,
			hasMore: false,
		});
	});

	it("does nothing when the unjudged target is already met", async () => {
		const { store } = testStore();
		await seed(store, POOL);
		await fillFeed(fillRequest(store));
		const result = await fillFeed(fillRequest(store));
		expect(result).toEqual({
			added: 0,
			unjudged: 2,
			total: 2,
			judged: 0,
			hasMore: false,
		});
	});

	it("emits offer.passed for each added offer", async () => {
		const { store } = testStore();
		await seed(store, [
			{ id: "newest", enteredAt: "2026-10-03T00:00:00.000Z" },
		]);
		const emitted: PipelineEvent[] = [];
		const bus: EventBus = {
			on() {},
			async emit(event) {
				emitted.push(event);
			},
		};
		await fillFeed(fillRequest(store, { events: bus }));
		expect(emitted).toEqual(["offer.passed"]);
	});
});

describe("getFeedStatus", () => {
	it("splits the feed into judged and unjudged", async () => {
		const { store } = testStore();
		await seed(store, POOL);
		await fillFeed(fillRequest(store));
		await store.saveDecision({
			memberId: MEMBER,
			offerId: "newest",
			marketStatus: "screened",
			userStatus: "none",
		});
		expect(await getFeedStatus({ store, memberId: MEMBER })).toEqual({
			total: 2,
			unjudged: 1,
			judged: 1,
		});
	});
});
