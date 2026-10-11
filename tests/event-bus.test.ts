import { describe, expect, it } from "vitest";
import { createEventBus } from "../src/adapters/secondary/event-bus.js";
import type { Offer } from "../src/core/domain/offer.js";

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

describe("createEventBus", () => {
	it("calls only the handlers subscribed to the event", async () => {
		const called: string[] = [];
		const bus = createEventBus(() => {});
		bus.on("offer.passed", () => {
			called.push("passed");
		});
		bus.on("offer.screened", () => {
			called.push("screened");
		});
		await bus.emit("offer.passed", payload);
		expect(called).toEqual(["passed"]);
	});

	it("is best-effort: a failing handler is logged, the rest still run", async () => {
		const called: string[] = [];
		const logged: string[] = [];
		const bus = createEventBus((message) => logged.push(message));
		bus.on("offer.passed", () => {
			throw new Error("boom");
		});
		bus.on("offer.passed", () => {
			called.push("second");
		});
		await bus.emit("offer.passed", payload);
		expect(called).toEqual(["second"]);
		expect(logged).toHaveLength(1);
	});
});
