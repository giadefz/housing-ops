import {
	InvalidTransitionError,
	InvalidVerdictError,
} from "../errors/offer.js";
import {
	ANALYSE_VERDICTS,
	TRIAGE_VERDICTS,
	type Analysis,
	type AnalysisTier,
	type AnalysisVerdict,
	type Interaction,
} from "./analysis.js";
import type {
	MarketEvent,
	MarketOutcome,
	MarketStatus,
	UserAction,
	UserStatus,
} from "./decision.js";

export { MARKET_STATUSES, USER_STATUSES } from "./decision.js";
export type {
	MarketEvent,
	MarketOutcome,
	MarketStatus,
	UserAction,
	UserStatus,
} from "./decision.js";

/** All markets. Single source for the Market union. */
export const MARKETS = ["rent", "buy"] as const;

/** Rent or buy. */
export type Market = (typeof MARKETS)[number];

/** A market sighting of a dwelling. Aggregate root. Identity is provider plus listing id. */
export interface Offer {
	id: string;
	dwellingId: string;
	provider: string;
	listingId: string;
	url: string;
	market: Market;
	price: Price;
	images: string[];
	description: string;
	postedAt?: string;
	fetchedAt: string;
	versions: OfferVersion[];
	marketStatus: MarketStatus;
	userStatus: UserStatus;
	analyses: Analysis[];
	interactions: Interaction[];
}

/** One fetch of the listing. Immutable. */
export interface OfferVersion {
	version: number;
	fetchedAt: string;
	price: Price;
	payload: unknown;
}

/** All price periods. Single source for the Price period union. */
export const PRICE_PERIODS = ["month", "once"] as const;

/** A listed price. */
export interface Price {
	amount: number;
	currency: string;
	period: (typeof PRICE_PERIODS)[number];
}

type MarketTransitions = Partial<Record<MarketEvent, MarketStatus>>;

/** Moves allowed from any open market status: judgments and market outcomes. */
const OPEN_MARKET_TRANSITIONS: MarketTransitions = {
	screened: "screened",
	shortlist: "shortlisted",
	reject: "rejected",
	hold: "held",
	let: "let",
	sold: "sold",
	gone: "gone",
};

/** The market machine. A closed offer (let/sold/gone) has no moves. */
const MARKET_TRANSITIONS: Record<MarketStatus, MarketTransitions> = {
	seen: { clear: "passed", park: "pending", ...OPEN_MARKET_TRANSITIONS },
	passed: OPEN_MARKET_TRANSITIONS,
	pending: OPEN_MARKET_TRANSITIONS,
	screened: OPEN_MARKET_TRANSITIONS,
	shortlisted: OPEN_MARKET_TRANSITIONS,
	rejected: OPEN_MARKET_TRANSITIONS,
	held: OPEN_MARKET_TRANSITIONS,
	let: {},
	sold: {},
	gone: {},
};

/** Moves an offer along the market machine, or throws when the move is illegal. */
export function transitionMarket(offer: Offer, event: MarketEvent): Offer {
	const target = MARKET_TRANSITIONS[offer.marketStatus][event];
	if (target === undefined)
		throw new InvalidTransitionError(offer.marketStatus, event);
	return { ...offer, marketStatus: target };
}

/** Moves a fresh sighting straight to the terminal queue. Only from seen. */
export function clearFilters(offer: Offer): Offer {
	return transitionMarket(offer, "clear");
}

/** Parks a fresh sighting for agent judgment. Only from seen. */
export function parkForJudgment(offer: Offer): Offer {
	return transitionMarket(offer, "park");
}

/** Verdicts each tier may return. `screened` is triage-only, `shortlist` analysis-only. */
const TIER_VERDICTS: Record<AnalysisTier, readonly AnalysisVerdict[]> = {
	triage: TRIAGE_VERDICTS,
	analyse: ANALYSE_VERDICTS,
};

/** Records a judgment. A later judgment supersedes the earlier one. */
export function recordJudgment(
	offer: Offer,
	tier: AnalysisTier,
	verdict: AnalysisVerdict,
): Offer {
	if (!TIER_VERDICTS[tier].includes(verdict))
		throw new InvalidVerdictError(tier, verdict);
	return transitionMarket(offer, verdict);
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
export function recordUserAction(offer: Offer, action: UserAction): Offer {
	if (isMarketClosed(offer.marketStatus))
		throw new InvalidTransitionError(offer.marketStatus, action);
	const target = USER_ACTION_STATUS[action];
	return {
		...offer,
		userStatus: target === SELF ? offer.userStatus : target,
	};
}

function isMarketClosed(status: MarketStatus): boolean {
	return status === "let" || status === "sold" || status === "gone";
}

/** Records a market outcome. Closes the listing; closed is final. */
export function recordMarketEvent(offer: Offer, outcome: MarketOutcome): Offer {
	return transitionMarket(offer, outcome);
}
