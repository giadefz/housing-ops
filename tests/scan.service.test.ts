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
import { findOfferByListing } from "../src/adapters/secondary/storage/sqlite/offer.js";
import { irelandPack } from "../src/countries/ie/pack.js";
import type { Listing } from "../src/core/domain/listing.js";
import type { ClockPort } from "../src/core/ports/clock.port.js";
import type {
	FetchContext,
	ProviderPort,
} from "../src/core/ports/provider.port.js";
import { scan } from "../src/core/services/scan.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

function testDatabase(): Database.Database {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	const database = openStore(path.join(root, "housing.db"));
	cleanups.push(() => {
		closeStore(database);
		fs.rmSync(root, { recursive: true, force: true });
	});
	return database;
}

const clock: ClockPort = { now: () => "2026-10-04T00:00:00.000Z" };

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

function providerOf(records: unknown[]): ProviderPort {
	return {
		id: "fake",
		country: "ie",
		markets: ["rent"],
		async *fetch(_config: unknown, _context: FetchContext) {
			for (const record of records) yield record as Listing;
		},
	};
}

describe("scan", () => {
	it("normalizes and stores valid listings", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const result = await scan({
			providers: [providerOf([listing("a"), listing("b")])],
			store,
			pack: irelandPack,
			clock,
		});
		expect(result).toEqual({ fetched: 2, stored: 2, deadLettered: 0 });
		const offer = await findOfferByListing(database, "fake", "a");
		expect(offer?.status).toBe("seen");
		expect(offer?.price.amount).toBe(2000);
		expect(offer?.versions).toHaveLength(1);
	});

	it("dead-letters a malformed listing", async () => {
		const database = testDatabase();
		const store = createSqliteStore(database);
		const result = await scan({
			providers: [providerOf([listing("ok"), { listing_id: "bad" }])],
			store,
			pack: irelandPack,
			clock,
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
		const providers = [providerOf([listing("a")])];
		await scan({ providers, store, pack: irelandPack, clock });
		await scan({ providers, store, pack: irelandPack, clock });
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
		await scan({
			providers: [providerOf([listing("a")])],
			store,
			pack: irelandPack,
			clock,
		});
		const cheaper = listing("a", {
			price: { amount: 1800, currency: "EUR", period: "month" },
		});
		await scan({
			providers: [providerOf([cheaper])],
			store,
			pack: irelandPack,
			clock,
		});
		const offer = await findOfferByListing(database, "fake", "a");
		expect(offer?.versions).toHaveLength(2);
		expect(offer?.price.amount).toBe(1800);
	});
});
