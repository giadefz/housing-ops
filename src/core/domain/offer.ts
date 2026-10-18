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
