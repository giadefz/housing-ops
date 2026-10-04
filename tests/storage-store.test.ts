import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import type { Offer } from "../src/core/domain/offer.js";
import {
	closeStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import {
	findDwellingByAddressKey,
	saveDwelling,
} from "../src/adapters/secondary/storage/sqlite/dwelling.js";
import {
	findOffer,
	findOfferByListing,
	saveOffer,
} from "../src/adapters/secondary/storage/sqlite/offer.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

function testDatabase(): Database.Database {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	const file = path.join(root, "housing.db");
	const database = openStore(file);
	cleanups.push(() => {
		closeStore(database);
		fs.rmSync(root, { recursive: true, force: true });
	});
	return database;
}

function dwellingFixture(): Dwelling {
	return {
		id: "dw-1",
		addressKey: "12 main street dublin 8|d08ab12",
		address: { freeText: "12 Main Street, Dublin 8", locality: "Dublin" },
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
		versions: [
			{
				version: 1,
				fetchedAt: "2026-10-04T00:00:00.000Z",
				price: { amount: 2200, currency: "EUR", period: "month" },
				payload: { source: "test" },
			},
		],
		status: "seen",
		analyses: [],
		interactions: [],
	};
}

describe("dwellings", () => {
	it("round-trips a dwelling by address key", async () => {
		const database = testDatabase();
		await saveDwelling(database, dwellingFixture());
		expect(
			await findDwellingByAddressKey(
				database,
				"12 main street dublin 8|d08ab12",
			),
		).toEqual(dwellingFixture());
		expect(await findDwellingByAddressKey(database, "nowhere")).toBeNull();
	});
	it("replaces a dwelling on re-save", async () => {
		const database = testDatabase();
		await saveDwelling(database, dwellingFixture());
		await saveDwelling(database, {
			...dwellingFixture(),
			attributes: { ber: "A" },
		});
		expect(
			(
				await findDwellingByAddressKey(
					database,
					"12 main street dublin 8|d08ab12",
				)
			)?.attributes,
		).toEqual({ ber: "A" });
	});
});

describe("offers", () => {
	it("round-trips an offer with versions", async () => {
		const database = testDatabase();
		await saveDwelling(database, dwellingFixture());
		await saveOffer(database, offerFixture());
		expect(await findOffer(database, "offer-1")).toEqual(offerFixture());
		expect(await findOffer(database, "missing")).toBeNull();
	});
	it("resolves by provider and listing id", async () => {
		const database = testDatabase();
		await saveDwelling(database, dwellingFixture());
		await saveOffer(database, offerFixture());
		expect((await findOfferByListing(database, "daft", "abc"))?.id).toBe(
			"offer-1",
		);
		expect(
			await findOfferByListing(database, "daft", "missing"),
		).toBeNull();
	});
	it("versions instead of duplicating on re-save", async () => {
		const database = testDatabase();
		await saveDwelling(database, dwellingFixture());
		await saveOffer(database, offerFixture());
		await saveOffer(database, offerFixture());
		const unchanged = await findOffer(database, "offer-1");
		expect(unchanged?.versions).toHaveLength(1);
		const refetched = {
			...offerFixture(),
			price: { amount: 2100, currency: "EUR", period: "month" as const },
			fetchedAt: "2026-10-05T00:00:00.000Z",
			status: "passed" as const,
			versions: [
				...offerFixture().versions,
				{
					version: 2,
					fetchedAt: "2026-10-05T00:00:00.000Z",
					price: {
						amount: 2100,
						currency: "EUR",
						period: "month" as const,
					},
					payload: { source: "test" },
				},
			],
		};
		await saveOffer(database, refetched);
		const updated = await findOffer(database, "offer-1");
		expect(updated?.versions).toHaveLength(2);
		expect(updated?.price.amount).toBe(2100);
		expect(updated?.status).toBe("passed");
	});
});
