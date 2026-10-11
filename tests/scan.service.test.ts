import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createEventBus } from "../src/adapters/secondary/event-bus.js";
import {
	closeStore,
	createSqliteStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import { findOfferByListing } from "../src/adapters/secondary/storage/sqlite/offer.js";
import { irelandPack } from "../src/countries/ie/pack.js";
import type { PipelineEvent } from "../src/core/domain/events.js";
import type { Listing } from "../src/core/domain/listing.js";
import { budgetFilter } from "../src/core/filters/budget.js";
import type { ClockPort } from "../src/core/ports/clock.port.js";
import type { EventBus } from "../src/core/ports/event-bus.port.js";
import type {
	FetchContext,
	ProviderPort,
} from "../src/core/ports/provider.port.js";
import type { Profile } from "../src/core/schemas/profile.js";
import type { FilterStage } from "../src/core/services/pipeline.service.js";
import { scan } from "../src/core/services/scan.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

const clock: ClockPort = { now: () => "2026-10-04T00:00:00.000Z" };
const budgetStage: FilterStage = { filter: budgetFilter, missing: "fail" };
const silentBus: EventBus = { on() {}, async emit() {} };

function testDatabase(): Database.Database {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	const database = openStore(path.join(root, "housing.db"));
	cleanups.push(() => {
		closeStore(database);
		fs.rmSync(root, { recursive: true, force: true });
	});
	return database;
}

function profile(overrides: Partial<Profile> = {}): Profile {
	return {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: false,
		recheckHours: 48,
		...overrides,
	};
}

function listing(id: string, overrides: Partial<Listing> = {}): Listing {
	return {
		listing_id: id,
		url: `https://example.invalid/${id}`,
		market: "rent",
		price: { amount: 2000, currency: "EUR", period: "month" },
		address_text: `${id} Main Street, Dublin 8`,
		extra: { ber: "B", eircode: `D08${id}` },
		...overrides,
	};
}

function providerOf(records: unknown[], id = "fake"): ProviderPort {
	return {
		id,
		country: "ie",
		markets: ["rent"],
		async *fetch(_config: unknown, _context: FetchContext) {
			for (const record of records) yield record as Listing;
		},
	};
}

function verdicts(database: Database.Database): unknown[] {
	return database.prepare("SELECT filter_id, outcome FROM verdicts").all();
}

describe("scan", () => {
	it("normalizes, filters, and stores a passing listing as passed", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const result = await scan({
			providers: [providerOf([listing("a")])],
			events: silentBus,
			store,
			pack: irelandPack,
			clock,
			profile: profile(),
			filters: [budgetStage],
		});
		expect(result).toEqual({ fetched: 1, stored: 1, deadLettered: 0 });
		const offer = await findOfferByListing(database, "fake", "a");
		expect(offer?.marketStatus).toBe("passed");
		expect(verdicts(database)).toEqual([
			{ filter_id: "budget", outcome: "pass" },
		]);
	});

	it("parks a passing offer as pending when the gate is on", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		await scan({
			providers: [providerOf([listing("a")])],
			events: silentBus,
			store,
			pack: irelandPack,
			clock,
			profile: profile({ gate: true }),
			filters: [budgetStage],
		});
		const offer = await findOfferByListing(database, "fake", "a");
		expect(offer?.marketStatus).toBe("pending");
	});

	it("leaves a filtered-out offer seen and records the failing verdict", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		await scan({
			providers: [providerOf([listing("a")])],
			events: silentBus,
			store,
			pack: irelandPack,
			clock,
			profile: profile({ budget: { max: 1000, currency: "EUR" } }),
			filters: [budgetStage],
		});
		const offer = await findOfferByListing(database, "fake", "a");
		expect(offer?.marketStatus).toBe("seen");
		expect(verdicts(database)).toEqual([
			{ filter_id: "budget", outcome: "fail" },
		]);
	});

	it("dead-letters a malformed listing", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const result = await scan({
			providers: [providerOf([listing("ok"), { listing_id: "bad" }])],
			events: silentBus,
			store,
			pack: irelandPack,
			clock,
			profile: profile(),
			filters: [budgetStage],
		});
		expect(result).toEqual({ fetched: 2, stored: 1, deadLettered: 1 });
		const dead: unknown[] = database
			.prepare("SELECT * FROM dead_letter")
			.all();
		expect(dead).toHaveLength(1);
	});

	it("keeps one version when re-scanning an unchanged listing", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const dependencies = {
			providers: [providerOf([listing("a")])],
			events: silentBus,
			store,
			pack: irelandPack,
			clock,
			profile: profile(),
			filters: [budgetStage],
		};
		await scan(dependencies);
		await scan(dependencies);
		const offer = await findOfferByListing(database, "fake", "a");
		expect(offer?.versions).toHaveLength(1);
		const offers: unknown[] = database
			.prepare("SELECT * FROM offers")
			.all();
		expect(offers).toHaveLength(1);
	});

	it("adds a version when a re-scan finds a change", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const base = {
			events: silentBus,
			store,
			pack: irelandPack,
			clock,
			profile: profile(),
			filters: [budgetStage],
		};
		await scan({ ...base, providers: [providerOf([listing("a")])] });
		await scan({
			...base,
			providers: [
				providerOf([
					listing("a", {
						price: {
							amount: 1800,
							currency: "EUR",
							period: "month",
						},
					}),
				]),
			],
		});
		const offer = await findOfferByListing(database, "fake", "a");
		expect(offer?.versions).toHaveLength(2);
		expect(offer?.price.amount).toBe(1800);
		const offers: unknown[] = database
			.prepare("SELECT id FROM offers")
			.all();
		const versions = database
			.prepare("SELECT COUNT(*) AS count FROM offer_versions")
			.get() as { count: number };
		expect(offers).toHaveLength(1);
		expect(versions.count).toBe(2);
	});

	it("resolves one dwelling for the same address from two providers", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const shared = {
			address_text: "1 Same Street, Dublin 8",
			extra: { ber: "B", eircode: "D08AAAA" },
		};
		await scan({
			providers: [
				providerOf([listing("x", shared)], "one"),
				providerOf([listing("y", shared)], "two"),
			],
			events: silentBus,
			store,
			pack: irelandPack,
			clock,
			profile: profile(),
			filters: [budgetStage],
		});
		const dwellings: unknown[] = database
			.prepare("SELECT id FROM dwellings")
			.all();
		const offers: unknown[] = database
			.prepare("SELECT provider, dwelling_id FROM offers")
			.all();
		const dwellingIds = offers.map(
			(row) => (row as { dwelling_id: string }).dwelling_id,
		);
		expect(dwellings).toHaveLength(1);
		expect(offers).toHaveLength(2);
		expect(new Set(dwellingIds).size).toBe(1);
	});
});

describe("scan publishing", () => {
	function spyBus(): { bus: EventBus; emitted: PipelineEvent[] } {
		const emitted: PipelineEvent[] = [];
		const bus: EventBus = {
			on() {},
			async emit(event) {
				emitted.push(event);
			},
		};
		return { bus, emitted };
	}

	it("emits offer.passed for a newly passing offer", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const { bus, emitted } = spyBus();
		await scan({
			providers: [providerOf([listing("a")])],
			events: bus,
			store,
			pack: irelandPack,
			clock,
			profile: profile(),
			filters: [budgetStage],
		});
		expect(emitted).toEqual(["offer.passed"]);
	});

	it("emits offer.updated when a relist changes", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const { bus, emitted } = spyBus();
		const base = {
			store,
			events: bus,
			pack: irelandPack,
			clock,
			profile: profile(),
			filters: [budgetStage],
		};
		await scan({ ...base, providers: [providerOf([listing("a")])] });
		await scan({
			...base,
			providers: [
				providerOf([
					listing("a", {
						price: {
							amount: 1800,
							currency: "EUR",
							period: "month",
						},
					}),
				]),
			],
		});
		expect(emitted).toEqual(["offer.passed", "offer.updated"]);
	});

	it("keeps the scan successful when a handler throws", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const bus = createEventBus(() => {});
		bus.on("offer.passed", () => {
			throw new Error("boom");
		});
		const result = await scan({
			providers: [providerOf([listing("a")])],
			events: bus,
			store,
			pack: irelandPack,
			clock,
			profile: profile(),
			filters: [budgetStage],
		});
		expect(result.stored).toBe(1);
	});
});

describe("scan gate", () => {
	it("never parks a passing offer as pending when the gate is off", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		await scan({
			providers: [providerOf([listing("a")])],
			events: silentBus,
			store,
			pack: irelandPack,
			clock,
			profile: profile({ gate: false }),
			filters: [budgetStage],
		});
		const offer = await findOfferByListing(database, "fake", "a");
		expect(offer?.marketStatus).toBe("passed");
	});

	it("parks a passing offer as pending when the gate is on, and still emits offer.passed", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const emitted: PipelineEvent[] = [];
		const bus: EventBus = {
			on() {},
			async emit(event) {
				emitted.push(event);
			},
		};
		await scan({
			providers: [providerOf([listing("a")])],
			events: bus,
			store,
			pack: irelandPack,
			clock,
			profile: profile({ gate: true }),
			filters: [budgetStage],
		});
		const offer = await findOfferByListing(database, "fake", "a");
		expect(offer?.marketStatus).toBe("pending");
		expect(emitted).toEqual(["offer.passed"]);
	});
});
