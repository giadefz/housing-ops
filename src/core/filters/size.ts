import { toSquareMeters } from "../domain/dwelling.js";
import type { FilterPort } from "../ports/filter.port.js";

/** Passes when the size is at least the profile minimum. Skips when the size is unknown. */
export const sizeFilter: FilterPort = {
	id: "size",
	evaluate({ dwelling, profile }) {
		const minSizeM2 = profile.minSizeM2;
		if (minSizeM2 === undefined) return { outcome: "pass" };
		if (dwelling.size === undefined)
			return { outcome: "skip", reason: "size unknown" };
		const sizeM2 = toSquareMeters(dwelling.size);
		if (sizeM2 < minSizeM2) {
			return {
				outcome: "fail",
				reason: `${Math.round(sizeM2)}m² under min ${minSizeM2}m²`,
			};
		}
		return { outcome: "pass" };
	},
};
