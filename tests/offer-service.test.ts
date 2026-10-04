import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import type { Offer } from "../src/core/domain/offer.js";
import { OfferNotFoundError } from "../src/core/errors/offer.js";
import { getOffer } from "../src/core/services/offer.service.js";
import {
	createSqliteStore,
	closeStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

function testStore(): ReturnType<typeof createSqliteStore> {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	const database = openStore(path.join(root, "housing.db"));
	cleanups.push(() => {
		closeStore(database);
		fs.rmSync(root, { recursive: true, force: true });
	});
	void (database as Database.Database);
	return createSqliteStore(database);
}

function dwellingFixture(): Dwelling {
	return {
		id: "dw-1",
		addressKey: "12 main street dublin 8|d08ab12",
		address: { freeText: "12 Main Street, Dublin 8" },
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
	await store.recordVerdict("offer-1", "run-1", {
		filterId: "budget",
		outcome: "pass",
		reason: "",
	});
}

describe("getOffer", () => {
	it("returns the offer with its recorded verdicts", async () => {
		const store = testStore();
		await seed(store);
		const detail = await getOffer(store, "offer-1");
		expect(detail.offer.id).toBe("offer-1");
		expect(detail.offer.status).toBe("seen");
		expect(detail.verdicts).toEqual([
			{ filterId: "budget", outcome: "pass", reason: "" },
		]);
	});
	it("throws OfferNotFoundError for an unknown id", async () => {
		const store = testStore();
		await expect(getOffer(store, "missing")).rejects.toBeInstanceOf(
			OfferNotFoundError,
		);
	});
});
