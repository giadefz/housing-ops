import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type { Decision } from "../src/core/domain/decision.js";
import { DEFAULT_MEMBER_ID, type Member } from "../src/core/domain/member.js";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import type { Offer } from "../src/core/domain/offer.js";
import {
	closeStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import {
	findDecision,
	listDecisions,
	saveDecision,
} from "../src/adapters/secondary/storage/sqlite/decision.js";
import {
	findMember,
	listMembers,
	saveMember,
} from "../src/adapters/secondary/storage/sqlite/member.js";
import { saveDwelling } from "../src/adapters/secondary/storage/sqlite/dwelling.js";
import { saveOffer } from "../src/adapters/secondary/storage/sqlite/offer.js";

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

async function seedOffer(database: Database.Database): Promise<void> {
	const dwelling: Dwelling = {
		id: "dw-1",
		addressKey: "12 main street dublin 8|d08ab12",
		address: { freeText: "12 Main Street, Dublin 8", locality: "Dublin" },
		size: { value: 85, unit: "m2" },
		rooms: { bedrooms: 2 },
		layout: "apartment",
		attributes: { ber: "B" },
	};
	const offer: Offer = {
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
	await saveDwelling(database, dwelling);
	await saveOffer(database, offer);
}

describe("members", () => {
	it("seeds the built-in member on a fresh database", async () => {
		const database = testDatabase();
		const members = listMembers(database);
		expect(members.map((member) => member.id)).toEqual([DEFAULT_MEMBER_ID]);
		expect(members[0]?.role).toBe("admin");
	});

	it("saves and finds a member", async () => {
		const database = testDatabase();
		const member: Member = {
			id: "m-2",
			name: "Ada",
			role: "member",
			createdAt: "2026-10-05T00:00:00.000Z",
		};
		await saveMember(database, member);
		expect(findMember(database, "m-2")).toEqual(member);
		expect(findMember(database, "missing")).toBeNull();
	});
});

describe("decisions", () => {
	it("returns null when a member has not decided", async () => {
		const database = testDatabase();
		await seedOffer(database);
		expect(findDecision(database, DEFAULT_MEMBER_ID, "offer-1")).toBeNull();
	});

	it("saves, replaces, and lists decisions", async () => {
		const database = testDatabase();
		await seedOffer(database);
		const decision: Decision = {
			memberId: DEFAULT_MEMBER_ID,
			offerId: "offer-1",
			marketStatus: "pending",
			userStatus: "favorited",
		};
		await saveDecision(database, decision);
		expect(findDecision(database, DEFAULT_MEMBER_ID, "offer-1")).toEqual(
			decision,
		);

		await saveDecision(database, {
			...decision,
			marketStatus: "shortlisted",
		});
		expect(
			findDecision(database, DEFAULT_MEMBER_ID, "offer-1")?.marketStatus,
		).toBe("shortlisted");
		expect(listDecisions(database, DEFAULT_MEMBER_ID)).toEqual([
			{ ...decision, marketStatus: "shortlisted" },
		]);
	});
});
