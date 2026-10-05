import type { FilterPort } from "../ports/filter.port.js";

/** Passes when the price is within the profile budget. */
export const budgetFilter: FilterPort = {
	id: "budget",
	reads: ["budget"],
	evaluate({ offer, profile }) {
		const { amount } = offer.price;
		const { min, max } = profile.budget;
		if (amount > max)
			return { outcome: "fail", reason: `${amount} over max ${max}` };
		if (min !== undefined && amount < min) {
			return { outcome: "fail", reason: `${amount} under min ${min}` };
		}
		return { outcome: "pass" };
	},
};
