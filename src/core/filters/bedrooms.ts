import type { FilterPort } from "../ports/filter.port.js";

/** Passes when the bedroom count is within the profile range. Skips when unknown. */
export const bedroomsFilter: FilterPort = {
	id: "bedrooms",
	evaluate({ dwelling, prefs }) {
		const bedrooms = dwelling.rooms?.bedrooms;
		if (bedrooms === undefined)
			return { outcome: "skip", reason: "bedrooms unknown" };
		const { min, max } = prefs.bedrooms ?? {};
		if (min !== undefined && bedrooms < min) {
			return {
				outcome: "fail",
				reason: `${bedrooms} bed below min ${min}`,
			};
		}
		if (max !== undefined && bedrooms > max) {
			return {
				outcome: "fail",
				reason: `${bedrooms} bed above max ${max}`,
			};
		}
		return { outcome: "pass" };
	},
};
