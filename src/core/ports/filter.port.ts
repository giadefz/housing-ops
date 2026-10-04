import type { Dwelling } from "../domain/dwelling.js";
import type { Offer } from "../domain/offer.js";
import type { Profile } from "../domain/profile.js";
import type { Verdict } from "../domain/verdict.js";

/** Everything a filter may read: the sighting, the place, the profile, and comparables. */
export interface FilterInput {
	offer: Offer;
	dwelling: Dwelling;
	prefs: Profile;
	comparables: Offer[];
}

/** A pure judgment over one offer. Implemented by bundled and authored filters. */
export interface FilterPort {
	id: string;
	evaluate(input: FilterInput): Promise<Verdict>;
}
