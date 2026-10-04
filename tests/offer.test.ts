import { describe, expect, it } from "vitest";
import {
	clearFilters,
	parkForJudgment,
	recordAgentVerdict,
	recordMarketEvent,
	recordUserAction,
	type Offer,
} from "../src/core/domain/offer.js";

function seenOffer(): Offer {
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

describe("filter gate transitions", () => {
	it("clears seen offers straight to passed", () => {
		expect(clearFilters(seenOffer()).status).toBe("passed");
	});
	it("parks seen offers as pending when gated", () => {
		expect(parkForJudgment(seenOffer()).status).toBe("pending");
	});
	it("rejects gate transitions from any other status", () => {
		const passed = { ...seenOffer(), status: "passed" as const };
		expect(() => clearFilters(passed)).toThrow(/transition/);
		expect(() => parkForJudgment(passed)).toThrow(/transition/);
	});
});

describe("agent verdict transitions", () => {
	it("judges pending offers", () => {
		const pending = { ...seenOffer(), status: "pending" as const };
		expect(recordAgentVerdict(pending, "shortlist").status).toBe(
			"shortlisted",
		);
		expect(recordAgentVerdict(pending, "reject").status).toBe("rejected");
		expect(recordAgentVerdict(pending, "hold").status).toBe("held");
	});
	it("rejects verdicts on unseen offers", () => {
		expect(() => recordAgentVerdict(seenOffer(), "shortlist")).toThrow(
			/transition/,
		);
	});
});

describe("user action transitions", () => {
	it("moves through user states", () => {
		const passed = { ...seenOffer(), status: "passed" as const };
		expect(recordUserAction(passed, "favorited").status).toBe("favorited");
		expect(recordUserAction(passed, "viewing-requested").status).toBe(
			"viewing_requested",
		);
	});
	it("keeps status on share", () => {
		const passed = { ...seenOffer(), status: "passed" as const };
		expect(recordUserAction(passed, "shared").status).toBe("passed");
	});
	it("rejects actions on closed listings", () => {
		const gone = { ...seenOffer(), status: "gone" as const };
		expect(() => recordUserAction(gone, "favorited")).toThrow(/transition/);
	});
});

describe("market event transitions", () => {
	it("closes listings as let or sold", () => {
		const passed = { ...seenOffer(), status: "passed" as const };
		expect(recordMarketEvent(passed, "sold").status).toBe("sold");
		expect(recordMarketEvent(passed, "let").status).toBe("let");
	});
});
