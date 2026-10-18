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
import type { Decision, MarketStatus } from "../src/core/domain/decision.js";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";
import type { Offer } from "../src/core/domain/offer.js";
import type { ClockPort } from "../src/core/ports/clock.port.js";
import { interact } from "../src/core/services/interaction.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

const clock: ClockPort = { now: () => "2026-10-07T00:00:00.000Z" };
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
	};
}

async function seed(
	marketStatus: MarketStatus,
): Promise<ReturnType<typeof createSqliteStore>> {
	const { store } = testStore();
	await store.saveDwelling(dwellingFixture());
	await store.saveOffer(offerFixture());
	const decision: Decision = {
		memberId: MEMBER,
		offerId: "offer-1",
		marketStatus,
		userStatus: "none",
	};
	await store.saveDecision(decision);
	return store;
}

describe("interact", () => {
	it("records a favorite and moves the decision", async () => {
		const store = await seed("passed");
		const result = await interact({
			store,
			clock,
			memberId: MEMBER,
			offerId: "offer-1",
			input: { action: "favorited" },
		});
		const decision = await store.findDecision(MEMBER, "offer-1");
		const interactions = await store.listInteractions(MEMBER, "offer-1");
		expect(decision?.userStatus).toBe("favorited");
		expect(interactions).toHaveLength(1);
		expect(interactions[0]).toMatchObject({ action: "favorited" });
		expect(result.interactionId).toBe(interactions[0]?.id);
		expect(result.userStatus).toBe("favorited");
	});

	it("keeps the status on share but records the reaction", async () => {
		const store = await seed("passed");
		const result = await interact({
			store,
			clock,
			memberId: MEMBER,
			offerId: "offer-1",
			input: { action: "shared" },
		});
		const decision = await store.findDecision(MEMBER, "offer-1");
		const interactions = await store.listInteractions(MEMBER, "offer-1");
		expect(result.userStatus).toBe("none");
		expect(decision?.marketStatus).toBe("passed");
		expect(interactions[0]).toMatchObject({ action: "shared" });
	});

	it("records a rejection with a reason", async () => {
		const store = await seed("passed");
		await interact({
			store,
			clock,
			memberId: MEMBER,
			offerId: "offer-1",
			input: { action: "rejected", reason: "too small" },
		});
		const decision = await store.findDecision(MEMBER, "offer-1");
		const interactions = await store.listInteractions(MEMBER, "offer-1");
		expect(decision?.userStatus).toBe("rejected_by_user");
		expect(interactions[0]).toMatchObject({
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
				memberId: MEMBER,
				offerId: "offer-1",
				input: { action: "favorited" },
			}),
		).rejects.toThrow(/transition/);
	});
});
