import { describe, expect, it } from "vitest";
import { createEventBus } from "../src/adapters/secondary/publishers/event-bus.js";
import type { PipelineEvent } from "../src/core/domain/events.js";
import type { Offer } from "../src/core/domain/offer.js";
import type { PublisherPort } from "../src/core/ports/publisher.port.js";

function offerFixture(): Offer {
	return {
		id: "o1",
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
		marketStatus: "passed",
		userStatus: "none",
		analyses: [],
		interactions: [],
	};
}

const payload = { offer: offerFixture() };

function publisher(
	id: string,
	subscriptions: PipelineEvent[],
	fail = false,
): PublisherPort {
	return {
		id,
		subscriptions,
		async publish() {
			if (fail) throw new Error("boom");
		},
	};
}

describe("createEventBus", () => {
	it("routes an event to its subscribers only", async () => {
		const bus = createEventBus(
			[
				publisher("a", ["offer.passed"]),
				publisher("b", ["offer.screened"]),
			],
			() => {},
		);
		const outcomes = await bus.emit("offer.passed", payload);
		expect(outcomes).toEqual([
			{ subscriber: "a", event: "offer.passed", ok: true },
		]);
	});

	it("is best-effort: a failure is reported and logged, not thrown", async () => {
		const logged: string[] = [];
		const bus = createEventBus(
			[
				publisher("a", ["offer.passed"], true),
				publisher("b", ["offer.passed"]),
			],
			(message) => logged.push(message),
		);
		const outcomes = await bus.emit("offer.passed", payload);
		expect(outcomes[0]).toMatchObject({ subscriber: "a", ok: false });
		expect(outcomes[1]).toMatchObject({ subscriber: "b", ok: true });
		expect(logged).toHaveLength(1);
	});
});
