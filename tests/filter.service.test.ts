import { describe, expect, it } from "vitest";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import type { Offer } from "../src/core/domain/offer.js";
import { budgetFilter } from "../src/core/filters/budget.js";
import type { Profile } from "../src/core/schemas/profile.js";
import { checkFilter } from "../src/core/services/filter.service.js";

function offer(id: string, amount: number): Offer {
	return {
		id,
		dwellingId: "dw",
		provider: "fake",
		listingId: id,
		url: `https://example.invalid/${id}`,
		market: "rent",
		price: { amount, currency: "EUR", period: "month" },
		images: [],
		description: "",
		fetchedAt: "2026-10-04T00:00:00.000Z",
		versions: [],
		status: "seen",
		analyses: [],
		interactions: [],
	};
}

function dwelling(): Dwelling {
	return {
		id: "dw",
		addressKey: "key",
		address: { freeText: "1 Main Street, Dublin 8" },
		layout: "apartment",
		attributes: {},
	};
}

function profile(): Profile {
	return {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: false,
		recheckHours: 48,
	};
}

describe("checkFilter", () => {
	it("reports the verdict distribution and non-passing examples", () => {
		const result = checkFilter({
			filter: budgetFilter,
			profile: profile(),
			samples: [
				{ offer: offer("a", 2000), dwelling: dwelling() },
				{ offer: offer("b", 3000), dwelling: dwelling() },
			],
			exampleLimit: 5,
		});
		expect(result).toMatchObject({
			evaluated: 2,
			pass: 1,
			fail: 1,
			skip: 0,
		});
		expect(result.examples).toEqual([
			{ offerId: "b", outcome: "fail", reason: "3000 over max 2200" },
		]);
	});
});
