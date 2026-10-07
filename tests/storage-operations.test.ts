import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type { Analysis, Interaction } from "../src/core/domain/analysis.js";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import type { Offer } from "../src/core/domain/offer.js";
import {
	closeStore,
	createSqliteStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import { findOffer } from "../src/adapters/secondary/storage/sqlite/offer.js";
import { listQueue } from "../src/core/services/queue.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

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

function offerFixture(): Offer {
	return {
		id: "offer-1",
		dwellingId: "dw-1",
		provider: "daft",
		listingId: "abc",
		url: "https://example.invalid/abc",
		market: "rent",
		price: { amount: 2200, currency: "EUR", period: "month" },
		images: [],
		description: "Bright apartment",
		fetchedAt: "2026-10-04T00:00:00.000Z",
		versions: [],
		status: "seen",
		analyses: [],
		interactions: [],
	};
}

async function seed(
	store: ReturnType<typeof createSqliteStore>,
): Promise<void> {
	await store.saveDwelling(dwellingFixture());
	await store.saveOffer(offerFixture());
}

describe("queue", () => {
	it("returns compact rows joined with the dwelling", async () => {
		const { store } = testStore();
		await seed(store);
		const queue = await store.listQueue("seen", 10);
		expect(queue).toHaveLength(1);
		expect(queue[0]).toMatchObject({
			id: "offer-1",
			provider: "daft",
			price: { amount: 2200, currency: "EUR" },
			addressShort: "12 Main Street, Dublin 8",
			bedrooms: 2,
			sizeM2: 85,
			layout: "apartment",
			status: "seen",
		});
		expect(await store.listQueue("passed", 10)).toEqual([]);
	});
	it("counts offers by status", async () => {
		const { store } = testStore();
		await seed(store);
		expect(await store.countOffersByStatus("seen")).toBe(1);
		expect(await store.countOffersByStatus("passed")).toBe(0);
	});
	it("lists a page through the service with a total", async () => {
		const { store } = testStore();
		await seed(store);
		const page = await listQueue({
			store,
			input: { status: "seen", limit: 10 },
		});
		expect(page.offers).toHaveLength(1);
		expect(page.total).toBe(1);
	});
});

describe("verdicts and analyses", () => {
	it("records a filter verdict", async () => {
		const { database, store } = testStore();
		await seed(store);
		await store.recordVerdict("offer-1", "run-1", {
			filterId: "budget",
			outcome: "pass",
			reason: "",
		});
		const rows: unknown[] = database
			.prepare("SELECT * FROM verdicts")
			.all();
		expect(rows).toHaveLength(1);
	});
	it("appends an analysis and an interaction to the offer", async () => {
		const { database, store } = testStore();
		await seed(store);
		const analysis: Analysis = {
			id: "an-1",
			offerId: "offer-1",
			tier: "triage",
			verdict: "shortlist",
			reason: "good value",
			pros: ["bright"],
			cons: [],
			author: "agent",
			createdAt: "2026-10-04T01:00:00.000Z",
		};
		const interaction: Interaction = {
			id: "in-1",
			offerId: "offer-1",
			action: "favorited",
			createdAt: "2026-10-04T02:00:00.000Z",
		};
		await store.recordAnalysis(analysis);
		await store.recordInteraction(interaction);
		const offer = await findOffer(database, "offer-1");
		expect(offer?.analyses).toEqual([analysis]);
		expect(offer?.interactions).toEqual([interaction]);
	});
});

describe("runs", () => {
	it("opens and closes a run with stats", async () => {
		const { database, store } = testStore();
		const runId = await store.startRun("daft");
		await store.finishRun(runId, {
			fetched: 10,
			normalized: 9,
			passed: 4,
			failed: 5,
			skipped: 0,
			stored: 9,
		});
		const row = database
			.prepare("SELECT finished_at, stats FROM runs WHERE run_id = ?")
			.get(runId);
		expect(row).toMatchObject({
			stats: JSON.stringify({
				fetched: 10,
				normalized: 9,
				passed: 4,
				failed: 5,
				skipped: 0,
				stored: 9,
			}),
		});
	});
});

describe("market outcomes", () => {
	it("closes the offer and records the event", async () => {
		const { database, store } = testStore();
		await seed(store);
		await store.markMarketOutcome(
			"offer-1",
			"sold",
			"2026-10-05T00:00:00.000Z",
		);
		const offer = await findOffer(database, "offer-1");
		expect(offer?.status).toBe("sold");
		const events: unknown[] = database
			.prepare("SELECT * FROM market_events")
			.all();
		expect(events).toHaveLength(1);
	});
});
