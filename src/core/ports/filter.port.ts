import type { Dwelling } from "../domain/dwelling.js";
import type { Offer } from "../domain/offer.js";
import type { Profile } from "../domain/profile.js";

/** Everything a filter may read: the sighting, the place, the profile, and comparables. */
export interface FilterInput {
	offer: Offer;
	dwelling: Dwelling;
	prefs: Profile;
	comparables: Offer[];
}

/** A filter's judgment: pass, fail with a reason, or skip (insufficient data). */
export type FilterDecision =
	| { outcome: "pass" }
	| { outcome: "fail"; reason: string }
	| { outcome: "skip"; reason: string };

/** A pure judgment over one offer. Implemented by bundled and authored filters. */
export interface FilterPort {
	id: string;
	evaluate(input: FilterInput): FilterDecision;
}
