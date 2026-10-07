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

describe("judgment transitions", () => {
	it("records triage verdicts", () => {
		const pending = { ...seenOffer(), status: "pending" as const };
		expect(recordJudgment(pending, "triage", "screened").status).toBe(
			"screened",
		);
		expect(recordJudgment(pending, "triage", "reject").status).toBe(
			"rejected",
		);
		expect(recordJudgment(pending, "triage", "hold").status).toBe("held");
	});
	it("records analyse verdicts from screened", () => {
		const screened = { ...seenOffer(), status: "screened" as const };
		expect(recordJudgment(screened, "analyse", "shortlist").status).toBe(
			"shortlisted",
		);
		expect(recordJudgment(screened, "analyse", "reject").status).toBe(
			"rejected",
		);
		expect(recordJudgment(screened, "analyse", "hold").status).toBe("held");
	});
	it("supersedes an earlier judgment", () => {
		const shortlisted = { ...seenOffer(), status: "shortlisted" as const };
		expect(recordJudgment(shortlisted, "analyse", "reject").status).toBe(
			"rejected",
		);
	});
	it("refuses a verdict that does not belong to its tier", () => {
		const pending = { ...seenOffer(), status: "pending" as const };
		expect(() => recordJudgment(pending, "triage", "shortlist")).toThrow(
			/valid for tier/,
		);
		expect(() => recordJudgment(pending, "analyse", "screened")).toThrow(
			/valid for tier/,
		);
	});
	it("refuses judgments on closed listings", () => {
		const gone = { ...seenOffer(), status: "gone" as const };
		expect(() => recordJudgment(gone, "triage", "reject")).toThrow(
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
	it("treats a closed listing as final", () => {
		const gone = { ...seenOffer(), status: "gone" as const };
		expect(() => recordMarketEvent(gone, "let")).toThrow(/transition/);
	});
});
