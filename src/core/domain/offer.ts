import {
	InvalidTransitionError,
	InvalidVerdictError,
} from "../errors/offer.js";
import {
	ANALYSE_VERDICTS,
	INTERACTION_ACTIONS,
	TRIAGE_VERDICTS,
	type Analysis,
	type AnalysisTier,
	type AnalysisVerdict,
	type Interaction,
} from "./analysis.js";

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
	status: OfferStatus;
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

/** Every status an offer can hold. Single source for the OfferStatus union. */
export const OFFER_STATUSES = [
	"seen",
	"passed",
	"pending",
	"screened",
	"shortlisted",
	"rejected",
	"held",
	"viewed",
	"favorited",
	"viewing_requested",
	"visited",
	"rejected_by_user",
	"let",
	"sold",
	"gone",
] as const;

/** Every status an offer can hold. */
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** A user reaction that moves status. Sharing leaves status untouched. */
export type UserAction = (typeof INTERACTION_ACTIONS)[number];

/** True when a value is a known user action. */
export function isUserAction(value: string): value is UserAction {
	return (INTERACTION_ACTIONS as readonly string[]).includes(value);
}

/** A market outcome that closes the listing. */
export type MarketOutcome = "let" | "sold" | "gone";

/** Everything that can move an offer's status. */
export type OfferEvent =
	"clear" | "park" | AnalysisVerdict | UserAction | MarketOutcome;

const SELF: unique symbol = Symbol("self");

type TransitionTarget = OfferStatus | typeof SELF;
type Transitions = Partial<Record<OfferEvent, TransitionTarget>>;

/** Moves allowed from any open offer: judgments, reactions, and market outcomes. */
const OPEN_TRANSITIONS: Transitions = {
	screened: "screened",
	shortlist: "shortlisted",
	reject: "rejected",
	hold: "held",
	viewed: "viewed",
	favorited: "favorited",
	rejected: "rejected_by_user",
	"viewing-requested": "viewing_requested",
	visited: "visited",
	shared: SELF,
	let: "let",
	sold: "sold",
	gone: "gone",
};

/** The status machine. A closed offer (let/sold/gone) has no moves. */
const TRANSITIONS: Record<OfferStatus, Transitions> = {
	seen: { clear: "passed", park: "pending", ...OPEN_TRANSITIONS },
	passed: OPEN_TRANSITIONS,
	pending: OPEN_TRANSITIONS,
	screened: OPEN_TRANSITIONS,
	shortlisted: OPEN_TRANSITIONS,
	rejected: OPEN_TRANSITIONS,
	held: OPEN_TRANSITIONS,
	viewed: OPEN_TRANSITIONS,
	favorited: OPEN_TRANSITIONS,
	viewing_requested: OPEN_TRANSITIONS,
	visited: OPEN_TRANSITIONS,
	rejected_by_user: OPEN_TRANSITIONS,
	let: {},
	sold: {},
	gone: {},
};

/** Moves an offer along the status machine, or throws when the move is illegal. */
export function transition(offer: Offer, event: OfferEvent): Offer {
	const target = TRANSITIONS[offer.status][event];
	if (target === undefined)
		throw new InvalidTransitionError(offer.status, event);
	return { ...offer, status: target === SELF ? offer.status : target };
}

/** Moves a fresh sighting straight to the terminal queue. Only from seen. */
export function clearFilters(offer: Offer): Offer {
	return transition(offer, "clear");
}

/** Parks a fresh sighting for agent judgment. Only from seen. */
export function parkForJudgment(offer: Offer): Offer {
	return transition(offer, "park");
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
	return transition(offer, verdict);
}

/** Records a user reaction. Sharing leaves the status untouched. */
export function recordUserAction(offer: Offer, action: UserAction): Offer {
	return transition(offer, action);
}

/** Records a market outcome. Closes the listing; closed is final. */
export function recordMarketEvent(offer: Offer, outcome: MarketOutcome): Offer {
	return transition(offer, outcome);
}
