import { describe, expect, it } from "vitest";
import {
	clearFilters,
	parkForJudgment,
	recordJudgment,
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
		marketStatus: "seen",
		userStatus: "none",
		analyses: [],
		interactions: [],
	};
}

function inMarket(status: Offer["marketStatus"]): Offer {
	return { ...seenOffer(), marketStatus: status };
}

describe("filter gate transitions", () => {
	it("clears seen offers straight to passed", () => {
		expect(clearFilters(seenOffer()).marketStatus).toBe("passed");
	});
	it("parks seen offers as pending when gated", () => {
		expect(parkForJudgment(seenOffer()).marketStatus).toBe("pending");
	});
	it("rejects gate transitions from any other status", () => {
		expect(() => clearFilters(inMarket("passed"))).toThrow(/transition/);
		expect(() => parkForJudgment(inMarket("passed"))).toThrow(/transition/);
	});
});

describe("judgment transitions", () => {
	it("records triage verdicts", () => {
		expect(
			recordJudgment(inMarket("pending"), "triage", "screened")
				.marketStatus,
		).toBe("screened");
		expect(
			recordJudgment(inMarket("pending"), "triage", "reject")
				.marketStatus,
		).toBe("rejected");
		expect(
			recordJudgment(inMarket("pending"), "triage", "hold").marketStatus,
		).toBe("held");
	});
	it("records analyse verdicts from screened", () => {
		expect(
			recordJudgment(inMarket("screened"), "analyse", "shortlist")
				.marketStatus,
		).toBe("shortlisted");
		expect(
			recordJudgment(inMarket("screened"), "analyse", "reject")
				.marketStatus,
		).toBe("rejected");
		expect(
			recordJudgment(inMarket("screened"), "analyse", "hold")
				.marketStatus,
		).toBe("held");
	});
	it("supersedes an earlier judgment", () => {
		expect(
			recordJudgment(inMarket("shortlisted"), "analyse", "reject")
				.marketStatus,
		).toBe("rejected");
	});
	it("refuses a verdict that does not belong to its tier", () => {
		expect(() =>
			recordJudgment(inMarket("pending"), "triage", "shortlist"),
		).toThrow(/valid for tier/);
		expect(() =>
			recordJudgment(inMarket("pending"), "analyse", "screened"),
		).toThrow(/valid for tier/);
	});
	it("refuses judgments on closed listings", () => {
		expect(() =>
			recordJudgment(inMarket("gone"), "triage", "reject"),
		).toThrow(/transition/);
	});
});

describe("user action transitions", () => {
	it("moves the user status without touching the market status", () => {
		const passed = inMarket("passed");
		const favorited = recordUserAction(passed, "favorited");
		expect(favorited.userStatus).toBe("favorited");
		expect(favorited.marketStatus).toBe("passed");
		expect(recordUserAction(passed, "viewing-requested").userStatus).toBe(
			"viewing_requested",
		);
	});
	it("keeps the user status on share", () => {
		expect(recordUserAction(inMarket("passed"), "shared").userStatus).toBe(
			"none",
		);
	});
	it("rejects actions on closed listings", () => {
		expect(() => recordUserAction(inMarket("gone"), "favorited")).toThrow(
			/transition/,
		);
	});
});

describe("market event transitions", () => {
	it("closes listings as let or sold", () => {
		expect(recordMarketEvent(inMarket("passed"), "sold").marketStatus).toBe(
			"sold",
		);
		expect(recordMarketEvent(inMarket("passed"), "let").marketStatus).toBe(
			"let",
		);
	});
	it("treats a closed listing as final", () => {
		expect(() => recordMarketEvent(inMarket("gone"), "let")).toThrow(
			/transition/,
		);
	});
});
