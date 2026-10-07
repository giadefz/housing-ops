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
import { setVerdict } from "../src/core/services/verdict.service.js";

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

describe("setVerdict", () => {
	it("records a triage judgment and moves the offer to screened", async () => {
		const store = await seed("pending");
		const result = await setVerdict({
			store,
			clock,
			id: "offer-1",
			input: {
				tier: "triage",
				verdict: "screened",
				reason: "worth a look",
			},
		});
		const loaded = await store.findOffer("offer-1");
		expect(loaded?.marketStatus).toBe("screened");
		expect(loaded?.analyses).toHaveLength(1);
		expect(loaded?.analyses[0]).toMatchObject({
			tier: "triage",
			verdict: "screened",
			reason: "worth a look",
			author: "agent",
		});
		expect(result.analysisId).toBe(loaded?.analyses[0]?.id);
	});

	it("records an analyse judgment from screened", async () => {
		const store = await seed("screened");
		await setVerdict({
			store,
			clock,
			id: "offer-1",
			input: {
				tier: "analyse",
				verdict: "shortlist",
				reason: "great value",
				pros: ["bright", "quiet"],
				confidence: 0.8,
			},
		});
		const loaded = await store.findOffer("offer-1");
		expect(loaded?.marketStatus).toBe("shortlisted");
		expect(loaded?.analyses[0]).toMatchObject({
			verdict: "shortlist",
			pros: ["bright", "quiet"],
			confidence: 0.8,
		});
	});

	it("rejects a verdict outside its tier", async () => {
		const store = await seed("pending");
		await expect(
			setVerdict({
				store,
				clock,
				id: "offer-1",
				input: { tier: "triage", verdict: "shortlist", reason: "x" },
			}),
		).rejects.toThrow(/valid for tier/);
	});

	it("rejects an unknown offer", async () => {
		const store = await seed("pending");
		await expect(
			setVerdict({
				store,
				clock,
				id: "missing",
				input: { tier: "triage", verdict: "reject", reason: "x" },
			}),
		).rejects.toThrow(/not found/);
	});
});
