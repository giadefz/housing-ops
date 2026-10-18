import { describe, expect, it } from "vitest";
import {
	isMarketClosed,
	openDecision,
	recordJudgment,
	recordMarketEvent,
	recordUserAction,
	transitionMarket,
	type Decision,
	type MarketStatus,
} from "../src/core/domain/decision.js";

function open(): Decision {
	return openDecision("local", "offer-1");
}

function inMarket(status: MarketStatus): Decision {
	return { ...open(), marketStatus: status };
}

describe("open decisions", () => {
	it("starts unjudged with no market status", () => {
		expect(open().marketStatus).toBeUndefined();
		expect(open().userStatus).toBe("none");
		expect(isMarketClosed(open().marketStatus)).toBe(false);
	});
});

describe("judgment transitions", () => {
	it("records triage verdicts from an unjudged decision", () => {
		expect(recordJudgment(open(), "triage", "screened").marketStatus).toBe(
			"screened",
		);
		expect(recordJudgment(open(), "triage", "reject").marketStatus).toBe(
			"rejected",
		);
		expect(recordJudgment(open(), "triage", "hold").marketStatus).toBe(
			"held",
		);
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
		expect(() => recordJudgment(open(), "triage", "shortlist")).toThrow(
			/valid for tier/,
		);
		expect(() => recordJudgment(open(), "analyse", "screened")).toThrow(
			/valid for tier/,
		);
	});
	it("refuses judgments on closed listings", () => {
		expect(() =>
			recordJudgment(inMarket("gone"), "triage", "reject"),
		).toThrow(/transition/);
	});
});

describe("user action transitions", () => {
	it("moves the user status without touching the market status", () => {
		const favorited = recordUserAction(open(), "favorited");
		expect(favorited.userStatus).toBe("favorited");
		expect(favorited.marketStatus).toBeUndefined();
		expect(recordUserAction(open(), "viewing-requested").userStatus).toBe(
			"viewing_requested",
		);
	});
	it("keeps the user status on share", () => {
		expect(recordUserAction(open(), "shared").userStatus).toBe("none");
	});
	it("rejects actions on closed listings", () => {
		expect(() => recordUserAction(inMarket("gone"), "favorited")).toThrow(
			/transition/,
		);
	});
});

describe("market event transitions", () => {
	it("closes listings as let, sold, or gone", () => {
		expect(recordMarketEvent(open(), "sold").marketStatus).toBe("sold");
		expect(recordMarketEvent(open(), "let").marketStatus).toBe("let");
		expect(recordMarketEvent(open(), "gone").marketStatus).toBe("gone");
	});
	it("treats a closed listing as final", () => {
		expect(() => recordMarketEvent(inMarket("gone"), "let")).toThrow(
			/transition/,
		);
	});
});

describe("transition market", () => {
	it("accepts any event on an unjudged decision", () => {
		expect(transitionMarket(open(), "sold").marketStatus).toBe("sold");
	});
});
