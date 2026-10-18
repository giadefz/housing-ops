import { describe, expect, it } from "vitest";
import {
	clearFilters,
	parkForJudgment,
	recordJudgment,
	recordMarketEvent,
	recordUserAction,
	type Decision,
	type MarketStatus,
} from "../src/core/domain/decision.js";

function seen(): Decision {
	return {
		memberId: "local",
		offerId: "offer-1",
		marketStatus: "seen",
		userStatus: "none",
	};
}

function inMarket(status: MarketStatus): Decision {
	return { ...seen(), marketStatus: status };
}

describe("filter gate transitions", () => {
	it("clears seen decisions straight to passed", () => {
		expect(clearFilters(seen()).marketStatus).toBe("passed");
	});
	it("parks seen decisions as pending when gated", () => {
		expect(parkForJudgment(seen()).marketStatus).toBe("pending");
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
