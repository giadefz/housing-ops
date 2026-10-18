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
import type { EventBus } from "../src/core/ports/event-bus.port.js";
import type { OfferStorePort } from "../src/core/ports/store.port.js";
import { publishNow } from "../src/core/services/publish.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

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

function offerFixture(id: string): Offer {
	return {
		id,
		dwellingId: "dw-1",
		provider: "daft",
		listingId: id,
		url: `https://example.invalid/${id}`,
		market: "rent",
		price: { amount: 2200, currency: "EUR", period: "month" },
		images: [],
		description: "Bright apartment",
		fetchedAt: "2026-10-04T00:00:00.000Z",
		versions: [],
	};
}

async function seed(
	store: OfferStorePort,
	id: string,
	marketStatus: MarketStatus,
): Promise<void> {
	await store.saveOffer(offerFixture(id));
	const decision: Decision = {
		memberId: MEMBER,
		offerId: id,
		marketStatus,
		userStatus: "none",
	};
	await store.saveDecision(decision);
}

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

describe("publishNow", () => {
	it("re-delivers offer.passed over the member's feed", async () => {
		const { store } = testStore();
		await store.saveDwelling(dwellingFixture());
		await store.saveOffer(offerFixture("a"));
		await store.saveOffer(offerFixture("b"));
		await store.saveOffer(offerFixture("c"));
		await store.addToFeed({
			memberId: MEMBER,
			offerId: "a",
			addedAt: "2026-10-04T00:00:00.000Z",
			state: "to-evaluate",
		});
		await store.addToFeed({
			memberId: MEMBER,
			offerId: "b",
			addedAt: "2026-10-04T00:00:00.000Z",
			state: "accepted",
		});
		await store.saveDecision({
			memberId: MEMBER,
			offerId: "c",
			marketStatus: "screened",
			userStatus: "none",
		});
		const { bus, emitted } = spyBus();
		const result = await publishNow({
			store,
			events: bus,
			memberId: MEMBER,
			input: { event: "offer.passed", limit: 20 },
		});
		expect(result).toEqual({ event: "offer.passed", published: 2 });
		expect(emitted).toEqual(["offer.passed", "offer.passed"]);
	});

	it("honours the limit", async () => {
		const { store } = testStore();
		await store.saveDwelling(dwellingFixture());
		await seed(store, "a", "shortlisted");
		await seed(store, "b", "shortlisted");
		const { bus } = spyBus();
		const result = await publishNow({
			store,
			events: bus,
			memberId: MEMBER,
			input: { event: "offer.shortlisted", limit: 1 },
		});
		expect(result).toEqual({ event: "offer.shortlisted", published: 1 });
	});
});
