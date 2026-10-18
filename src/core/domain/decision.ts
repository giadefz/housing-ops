import {
	InvalidTransitionError,
	InvalidVerdictError,
} from "../errors/offer.js";
import {
	ANALYSE_VERDICTS,
	INTERACTION_ACTIONS,
	TRIAGE_VERDICTS,
	type AnalysisTier,
	type AnalysisVerdict,
} from "./analysis.js";

/** Every market status a member's decision can hold. Single source for the MarketStatus union. */
export const MARKET_STATUSES = [
	"screened",
	"shortlisted",
	"rejected",
	"held",
	"let",
	"sold",
	"gone",
] as const;

/** Where the listing is in one member's market life. */
export type MarketStatus = (typeof MARKET_STATUSES)[number];

/** Every user status. Single source for the UserStatus union. */
export const USER_STATUSES = [
	"none",
	"viewed",
	"favorited",
	"viewing_requested",
	"visited",
	"rejected_by_user",
] as const;

/** How one member relates to the offer. Layers on top of the market status. */
export type UserStatus = (typeof USER_STATUSES)[number];

/** A user reaction. Sharing leaves the user status untouched. */
export type UserAction = (typeof INTERACTION_ACTIONS)[number];

/** A market outcome that closes the listing. */
export type MarketOutcome = "let" | "sold" | "gone";

/** Everything that can move a decision's market status. */
export type MarketEvent = AnalysisVerdict | MarketOutcome;

/** One member's durable judgment history on one offer. */
export interface Decision {
	memberId: string;
	offerId: string;
	marketStatus?: MarketStatus;
	userStatus: UserStatus;
}

/** A member's standing on an offer they have not judged or reacted to yet. */
export function openDecision(memberId: string, offerId: string): Decision {
	return { memberId, offerId, userStatus: "none" };
}

/** The market status each event sets. Every open decision accepts every event. */
const EVENT_TARGET: Record<MarketEvent, MarketStatus> = {
	screened: "screened",
	shortlist: "shortlisted",
	reject: "rejected",
	hold: "held",
	let: "let",
	sold: "sold",
	gone: "gone",
};

/** Moves a decision along the market machine, or throws when the move is illegal. */
export function transitionMarket(
	decision: Decision,
	event: MarketEvent,
): Decision {
	if (isMarketClosed(decision.marketStatus))
		throw new InvalidTransitionError(
			decision.marketStatus ?? "unjudged",
			event,
		);
	return { ...decision, marketStatus: EVENT_TARGET[event] };
}

/** Verdicts each tier may return. `screened` is triage-only, `shortlist` analysis-only. */
const TIER_VERDICTS: Record<AnalysisTier, readonly AnalysisVerdict[]> = {
	triage: TRIAGE_VERDICTS,
	analyse: ANALYSE_VERDICTS,
};

/** Records a judgment. A later judgment supersedes the earlier one. */
export function recordJudgment(
	decision: Decision,
	tier: AnalysisTier,
	verdict: AnalysisVerdict,
): Decision {
	if (!TIER_VERDICTS[tier].includes(verdict))
		throw new InvalidVerdictError(tier, verdict);
	return transitionMarket(decision, verdict);
}

const SELF: unique symbol = Symbol("self");

/** The user status each reaction sets; sharing leaves it untouched. */
const USER_ACTION_STATUS: Record<UserAction, UserStatus | typeof SELF> = {
	viewed: "viewed",
	favorited: "favorited",
	rejected: "rejected_by_user",
	"viewing-requested": "viewing_requested",
	visited: "visited",
	shared: SELF,
};

/** Records a user reaction. Closed listings accept no reactions. */
export function recordUserAction(
	decision: Decision,
	action: UserAction,
): Decision {
	if (isMarketClosed(decision.marketStatus))
		throw new InvalidTransitionError(
			decision.marketStatus ?? "unjudged",
			action,
		);
	const target = USER_ACTION_STATUS[action];
	return {
		...decision,
		userStatus: target === SELF ? decision.userStatus : target,
	};
}

/** True once a listing has left the market: let, sold, or gone. Such a decision is final. */
export function isMarketClosed(status: MarketStatus | undefined): boolean {
	return status === "let" || status === "sold" || status === "gone";
}

/** Records a market outcome. Closes the listing; closed is final. */
export function recordMarketEvent(
	decision: Decision,
	outcome: MarketOutcome,
): Decision {
	return transitionMarket(decision, outcome);
}
