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
import { saveMember } from "../src/adapters/secondary/storage/sqlite/member.js";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import type { Decision } from "../src/core/domain/decision.js";
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";
import type { Offer } from "../src/core/domain/offer.js";
import type { ClockPort } from "../src/core/ports/clock.port.js";
import type { OfferStorePort } from "../src/core/ports/store.port.js";
import type { Profile } from "../src/core/schemas/profile.js";
import { buildDigest } from "../src/core/services/digest.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

const clock: ClockPort = { now: () => "2026-10-07T00:00:00.000Z" };
const MEMBER = DEFAULT_MEMBER_ID;

function testStore(): {
	database: Database.Database;
	store: OfferStorePort;
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

function profile(): Profile {
	return {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: true,
		recheckHours: 48,
	};
}

async function seed(store: OfferStorePort): Promise<void> {
	await store.saveDwelling(dwellingFixture());
	await store.saveOffer(offerFixture("a", 2000));
	await store.saveOffer(offerFixture("b", 1500));
	for (const offerId of ["a", "b"]) {
		const decision: Decision = {
			memberId: MEMBER,
			offerId,
			marketStatus: "seen",
			userStatus: "none",
		};
		await store.saveDecision(decision);
	}
}

describe("buildDigest", () => {
	it("summarizes interactions deterministically", async () => {
		const { store } = testStore();
		await seed(store);
		await store.recordInteraction({
			id: "i1",
			memberId: MEMBER,
			offerId: "a",
			action: "favorited",
			createdAt: "2026-10-07T00:00:00.000Z",
		});
		await store.recordInteraction({
			id: "i2",
			memberId: MEMBER,
			offerId: "b",
			action: "rejected",
			reason: "too small",
			createdAt: "2026-10-07T00:00:00.000Z",
		});
		await store.recordInteraction({
			id: "i3",
			memberId: MEMBER,
			offerId: "a",
			action: "viewed",
			createdAt: "2026-10-07T00:00:00.000Z",
		});
		const digest = await buildDigest({
			store,
			clock,
			profile: profile(),
			memberId: MEMBER,
		});
		expect(digest.stats.favorited.count).toBe(1);
		expect(digest.stats.favorited.offers[0]).toMatchObject({
			id: "a",
			price: { amount: 2000, currency: "EUR" },
		});
		expect(digest.stats.rejected).toEqual({
			count: 1,
			reasons: [{ value: "too small", count: 1 }],
		});
		expect(digest.stats.priceBands.favorited).toEqual({
			min: 2000,
			median: 2000,
			max: 2000,
		});
		expect(digest.stats.priceBands.overall).toEqual({
			min: 1500,
			median: 1750,
			max: 2000,
		});
		expect(digest.stats.topFeatures).toEqual({
			layouts: [{ value: "apartment", count: 1 }],
			bedrooms: [{ value: "2", count: 1 }],
			ber: [{ value: "B", count: 1 }],
		});
		expect(digest.stats.seen).toEqual({ viewed: 1, total: 2 });
		expect(digest.generatedAt).toBe("2026-10-07T00:00:00.000Z");
	});

	it("returns empty bands when nothing is stored", async () => {
		const { store } = testStore();
		const digest = await buildDigest({
			store,
			clock,
			profile: profile(),
			memberId: MEMBER,
		});
		expect(digest.stats.favorited.count).toBe(0);
		expect(digest.stats.priceBands).toEqual({
			favorited: null,
			overall: null,
		});
	});

	it("scopes the overall price band to the member", async () => {
		const { store, database } = testStore();
		await seed(store);
		await saveMember(database, {
			id: "bob",
			name: "Bob",
			role: "member",
			createdAt: "2026-10-07T00:00:00.000Z",
		});
		await store.saveOffer(offerFixture("c", 9000));
		await store.saveDecision({
			memberId: "bob",
			offerId: "c",
			marketStatus: "seen",
			userStatus: "none",
		});
		const mine = await buildDigest({
			store,
			clock,
			profile: profile(),
			memberId: MEMBER,
		});
		expect(mine.stats.priceBands.overall).toEqual({
			min: 1500,
			median: 1750,
			max: 2000,
		});
		const theirs = await buildDigest({
			store,
			clock,
			profile: profile(),
			memberId: "bob",
		});
		expect(theirs.stats.priceBands.overall).toEqual({
			min: 9000,
			median: 9000,
			max: 9000,
		});
	});
});
