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
import type { PipelineEvent } from "../src/core/domain/events.js";
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";
import type { Offer } from "../src/core/domain/offer.js";
import type { ClockPort } from "../src/core/ports/clock.port.js";
import type { EventBus } from "../src/core/ports/event-bus.port.js";
import { setVerdict } from "../src/core/services/verdict.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

const clock: ClockPort = { now: () => "2026-10-07T00:00:00.000Z" };
const silentBus: EventBus = { on() {}, async emit() {} };
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
	marketStatus?: MarketStatus,
): Promise<ReturnType<typeof createSqliteStore>> {
	const { store } = testStore();
	await store.saveDwelling(dwellingFixture());
	await store.saveOffer(offerFixture());
	if (marketStatus === undefined) return store;
	const decision: Decision = {
		memberId: MEMBER,
		offerId: "offer-1",
		marketStatus,
		userStatus: "none",
	};
	await store.saveDecision(decision);
	return store;
}

describe("setVerdict", () => {
	it("records a triage judgment and moves the decision to screened", async () => {
		const store = await seed();
		const result = await setVerdict({
			store,
			clock,
			events: silentBus,
			memberId: MEMBER,
			offerId: "offer-1",
			input: {
				tier: "triage",
				verdict: "screened",
				reason: "worth a look",
			},
		});
		const decision = await store.findDecision(MEMBER, "offer-1");
		const analyses = await store.listAnalyses(MEMBER, "offer-1");
		expect(decision?.marketStatus).toBe("screened");
		expect(analyses).toHaveLength(1);
		expect(analyses[0]).toMatchObject({
			tier: "triage",
			verdict: "screened",
			reason: "worth a look",
			author: "agent",
		});
		expect(result.analysisId).toBe(analyses[0]?.id);
	});

	it("records an analyse judgment from screened", async () => {
		const store = await seed("screened");
		await setVerdict({
			store,
			clock,
			events: silentBus,
			memberId: MEMBER,
			offerId: "offer-1",
			input: {
				tier: "analyse",
				verdict: "shortlist",
				reason: "great value",
				pros: ["bright", "quiet"],
				confidence: 0.8,
			},
		});
		const decision = await store.findDecision(MEMBER, "offer-1");
		const analyses = await store.listAnalyses(MEMBER, "offer-1");
		expect(decision?.marketStatus).toBe("shortlisted");
		expect(analyses[0]).toMatchObject({
			verdict: "shortlist",
			pros: ["bright", "quiet"],
			confidence: 0.8,
		});
	});

	it("rejects a verdict outside its tier", async () => {
		const store = await seed();
		await expect(
			setVerdict({
				store,
				clock,
				events: silentBus,
				memberId: MEMBER,
				offerId: "offer-1",
				input: { tier: "triage", verdict: "shortlist", reason: "x" },
			}),
		).rejects.toThrow(/valid for tier/);
	});

	it("rejects an unknown offer", async () => {
		const store = await seed();
		await expect(
			setVerdict({
				store,
				clock,
				events: silentBus,
				memberId: MEMBER,
				offerId: "missing",
				input: { tier: "triage", verdict: "reject", reason: "x" },
			}),
		).rejects.toThrow(/not found/);
	});
});

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

describe("setVerdict events", () => {
	it("emits offer.screened on a triage screened", async () => {
		const store = await seed();
		const { bus, emitted } = spyBus();
		await setVerdict({
			store,
			clock,
			events: bus,
			memberId: MEMBER,
			offerId: "offer-1",
			input: {
				tier: "triage",
				verdict: "screened",
				reason: "worth a look",
			},
		});
		expect(emitted).toEqual(["offer.screened"]);
	});

	it("emits offer.shortlisted on an analyse shortlist", async () => {
		const store = await seed("screened");
		const { bus, emitted } = spyBus();
		await setVerdict({
			store,
			clock,
			events: bus,
			memberId: MEMBER,
			offerId: "offer-1",
			input: { tier: "analyse", verdict: "shortlist", reason: "great" },
		});
		expect(emitted).toEqual(["offer.shortlisted"]);
	});

	it("emits nothing for a reject", async () => {
		const store = await seed();
		const { bus, emitted } = spyBus();
		await setVerdict({
			store,
			clock,
			events: bus,
			memberId: MEMBER,
			offerId: "offer-1",
			input: { tier: "triage", verdict: "reject", reason: "no" },
		});
		expect(emitted).toEqual([]);
	});
});
