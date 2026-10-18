import { INTERACTION_ACTIONS, type AnalysisVerdict } from "./analysis.js";

/** Every market status a member's decision can hold. Single source for the MarketStatus union. */
export const MARKET_STATUSES = [
	"seen",
	"passed",
	"pending",
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
export type MarketEvent = "clear" | "park" | AnalysisVerdict | MarketOutcome;

/** One member's durable standing on one offer. */
export interface Decision {
	memberId: string;
	offerId: string;
	marketStatus: MarketStatus;
	userStatus: UserStatus;
}

/** A member's opening standing on an offer they have not acted on yet. */
export function freshDecision(memberId: string, offerId: string): Decision {
	return { memberId, offerId, marketStatus: "seen", userStatus: "none" };
}
