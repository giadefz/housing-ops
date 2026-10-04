import type { LayoutType } from "./dwelling.js";
import type { Market } from "./offer.js";

/** The user's stated search. Lives in profile.yml; the digest joins it with learned signal. */
export interface Profile {
	market: Market;
	country: string;
	budget: Budget;
	areas: string[];
	layouts?: LayoutType[];
	bedrooms?: { min?: number; max?: number };
	minSizeM2?: number;
	dealBreakers?: string[];
	notes?: string;
	gate: boolean;
	recheckHours: number;
}

/** Spending bounds with currency. */
export interface Budget {
	max: number;
	currency: string;
	min?: number;
}
