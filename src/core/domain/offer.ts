import type { Analysis, Interaction } from "./analysis.js";

/** Rent or buy. */
export type Market = "rent" | "buy";

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

/** A listed price. */
export interface Price {
	amount: number;
	currency: string;
	period: "month" | "once";
}

/** Every status an offer can hold. */
export type OfferStatus =
	| "seen"
	| "passed"
	| "pending"
	| "shortlisted"
	| "rejected"
	| "held"
	| "viewed"
	| "favorited"
	| "viewing_requested"
	| "visited"
	| "rejected_by_user"
	| "let"
	| "sold"
	| "gone";

/** A market verdict on one offer. */
export type AgentVerdict = "shortlist" | "reject" | "hold";

/** A user reaction that moves status. Sharing leaves status untouched. */
export type UserAction =
	| "viewed"
	| "favorited"
	| "rejected"
	| "viewing-requested"
	| "visited"
	| "shared";

/** A market outcome that closes the listing. */
export type MarketOutcome = "let" | "sold" | "gone";

/** Thrown when a status move is illegal. */
export class InvalidTransitionError extends Error {
	constructor(status: OfferStatus, action: string) {
		super(`illegal transition from ${status} in ${action}`);
		this.name = "InvalidTransitionError";
	}
}

/** Moves a fresh sighting straight to the terminal queue. Only from seen. */
export function clearFilters(offer: Offer): Offer {
	rejectUnlessSeen(offer, "clearFilters");
	return { ...offer, status: "passed" };
}

/** Parks a fresh sighting for agent judgment. Only from seen. */
export function parkForJudgment(offer: Offer): Offer {
	rejectUnlessSeen(offer, "parkForJudgment");
	return { ...offer, status: "pending" };
}

function rejectUnlessSeen(offer: Offer, action: string): void {
	if (offer.status !== "seen")
		throw new InvalidTransitionError(offer.status, action);
}

const AGENT_VERDICT_STATUS = {
	shortlist: "shortlisted",
	reject: "rejected",
	hold: "held",
} as const;

/** Records an agent judgment. Only on queued offers. */
export function recordAgentVerdict(offer: Offer, verdict: AgentVerdict): Offer {
	if (offer.status !== "pending" && offer.status !== "passed") {
		throw new InvalidTransitionError(offer.status, "recordAgentVerdict");
	}
	return { ...offer, status: AGENT_VERDICT_STATUS[verdict] };
}

const USER_ACTION_STATUS = {
	viewed: "viewed",
	favorited: "favorited",
	rejected: "rejected_by_user",
	"viewing-requested": "viewing_requested",
	visited: "visited",
	shared: null,
} as const;

/** Records a user reaction. Closed listings stay closed. */
export function recordUserAction(offer: Offer, action: UserAction): Offer {
	if (
		offer.status === "let" ||
		offer.status === "sold" ||
		offer.status === "gone"
	) {
		throw new InvalidTransitionError(offer.status, "recordUserAction");
	}
	const status = USER_ACTION_STATUS[action];
	if (status === null) return offer;
	return { ...offer, status };
}

/** Records a market outcome. Closes the listing. */
export function recordMarketEvent(offer: Offer, outcome: MarketOutcome): Offer {
	return { ...offer, status: outcome };
}
