import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { findOffer } from "../src/adapters/secondary/storage/sqlite/offer.js";
import {
	closeStore,
	createSqliteStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import type { PipelineEvent } from "../src/core/domain/events.js";
import type { Offer } from "../src/core/domain/offer.js";
import type { ClockPort } from "../src/core/ports/clock.port.js";
import type { EventBus } from "../src/core/ports/event-bus.port.js";
import { markOutcome } from "../src/core/services/market.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

const clock: ClockPort = { now: () => "2026-10-05T00:00:00.000Z" };
const silentBus: EventBus = { on() {}, async emit() {} };

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

function offerFixture(marketStatus: Offer["marketStatus"]): Offer {
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
		marketStatus,
		userStatus: "none",
		analyses: [],
		interactions: [],
	};
}

async function seed(
	store: ReturnType<typeof createSqliteStore>,
): Promise<void> {
	await store.saveDwelling(dwellingFixture());
	await store.saveOffer(offerFixture("seen"));
}

describe("markOutcome", () => {
	it("closes the offer and appends the market event", async () => {
		const { database, store } = testStore();
		await seed(store);
		const closed = await markOutcome({
			store,
			clock,
			events: silentBus,
			id: "offer-1",
			outcome: "sold",
		});
		expect(closed.marketStatus).toBe("sold");
		expect((await findOffer(database, "offer-1"))?.marketStatus).toBe(
			"sold",
		);
		const events: unknown[] = database
			.prepare("SELECT outcome, observed_at FROM market_events")
			.all();
		expect(events).toEqual([
			{ outcome: "sold", observed_at: "2026-10-05T00:00:00.000Z" },
		]);
	});

	it("refuses a second outcome on a closed listing", async () => {
		const { store } = testStore();
		await seed(store);
		await markOutcome({
			store,
			clock,
			events: silentBus,
			id: "offer-1",
			outcome: "sold",
		});
		await expect(
			markOutcome({
				store,
				clock,
				events: silentBus,
				id: "offer-1",
				outcome: "let",
			}),
		).rejects.toThrow(/transition/);
	});

	it("emits offer.closed", async () => {
		const { store } = testStore();
		await seed(store);
		const emitted: PipelineEvent[] = [];
		const bus: EventBus = {
			on() {},
			async emit(event) {
				emitted.push(event);
			},
		};
		await markOutcome({
			store,
			clock,
			events: bus,
			id: "offer-1",
			outcome: "sold",
		});
		expect(emitted).toEqual(["offer.closed"]);
	});
});
