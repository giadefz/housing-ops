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
import type { Offer } from "../src/core/domain/offer.js";
import type { ClockPort } from "../src/core/ports/clock.port.js";
import { interact } from "../src/core/services/interaction.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

const clock: ClockPort = { now: () => "2026-10-07T00:00:00.000Z" };

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
	marketStatus: Offer["marketStatus"],
): Promise<ReturnType<typeof createSqliteStore>> {
	const { store } = testStore();
	await store.saveDwelling(dwellingFixture());
	await store.saveOffer(offerFixture(marketStatus));
	return store;
}

describe("interact", () => {
	it("records a favorite and moves the offer", async () => {
		const store = await seed("passed");
		const result = await interact({
			store,
			clock,
			id: "offer-1",
			input: { action: "favorited" },
		});
		const loaded = await store.findOffer("offer-1");
		expect(loaded?.userStatus).toBe("favorited");
		expect(loaded?.interactions).toHaveLength(1);
		expect(loaded?.interactions[0]).toMatchObject({ action: "favorited" });
		expect(result.interactionId).toBe(loaded?.interactions[0]?.id);
		expect(result.userStatus).toBe("favorited");
	});

	it("keeps the status on share but records the reaction", async () => {
		const store = await seed("passed");
		const result = await interact({
			store,
			clock,
			id: "offer-1",
			input: { action: "shared" },
		});
		const loaded = await store.findOffer("offer-1");
		expect(result.userStatus).toBe("none");
		expect(loaded?.marketStatus).toBe("passed");
		expect(loaded?.interactions[0]).toMatchObject({ action: "shared" });
	});

	it("records a rejection with a reason", async () => {
		const store = await seed("passed");
		await interact({
			store,
			clock,
			id: "offer-1",
			input: { action: "rejected", reason: "too small" },
		});
		const loaded = await store.findOffer("offer-1");
		expect(loaded?.userStatus).toBe("rejected_by_user");
		expect(loaded?.interactions[0]).toMatchObject({
			action: "rejected",
			reason: "too small",
		});
	});

	it("rejects reactions on closed listings", async () => {
		const store = await seed("gone");
		await expect(
			interact({
				store,
				clock,
				id: "offer-1",
				input: { action: "favorited" },
			}),
		).rejects.toThrow(/transition/);
	});
});
