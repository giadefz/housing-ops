import type { FilterPort } from "../ports/filter.port.js";

/** Passes when the layout is one of the profile's layouts. Unset means no constraint. */
export const typeFilter: FilterPort = {
	id: "type",
	evaluate({ dwelling, profile }) {
		const layouts = profile.layouts;
		if (layouts === undefined || layouts.length === 0)
			return { outcome: "pass" };
		if (layouts.includes(dwelling.layout)) return { outcome: "pass" };
		return {
			outcome: "fail",
			reason: `${dwelling.layout} not in ${layouts.join(", ")}`,
		};
	},
};
