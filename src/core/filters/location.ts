import { normalizeText } from "../text.js";
import type { FilterPort } from "../ports/filter.port.js";

/** Passes when the address names one of the profile areas. Skips when the address is empty. */
export const locationFilter: FilterPort = {
	id: "location",
	evaluate({ dwelling, profile }) {
		if (profile.areas.length === 0) return { outcome: "pass" };
		const address = normalizeText(dwelling.address.freeText);
		if (address.length === 0)
			return { outcome: "skip", reason: "address unknown" };
		const matched = profile.areas.some((area) =>
			address.includes(normalizeText(area)),
		);
		if (matched) return { outcome: "pass" };
		return {
			outcome: "fail",
			reason: `not in ${profile.areas.join(", ")}`,
		};
	},
};
