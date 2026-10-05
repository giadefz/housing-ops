import { describe, expect, it } from "vitest";
import { budgetFilter } from "../src/core/filters/budget.js";
import { bedroomsFilter } from "../src/core/filters/bedrooms.js";
import { locationFilter } from "../src/core/filters/location.js";
import type { Dwelling } from "../src/core/domain/dwelling.js";
import type { Offer } from "../src/core/domain/offer.js";
import type { Profile } from "../src/core/schemas/profile.js";
import type { FilterInput } from "../src/core/ports/filter.port.js";
import { runFilters } from "../src/core/services/pipeline.service.js";

function dwelling(overrides: Partial<Dwelling> = {}): Dwelling {
	return {
		id: "dw",
		addressKey: "key",
		address: { freeText: "12 Main Street, Dublin 8" },
		rooms: { bedrooms: 2 },
		layout: "apartment",
		attributes: {},
		...overrides,
	};
}

function offer(overrides: Partial<Offer> = {}): Offer {
	return {
		id: "offer",
		dwellingId: "dw",
		provider: "fake",
		listingId: "l1",
		url: "https://example.invalid/l1",
		market: "rent",
		price: { amount: 2000, currency: "EUR", period: "month" },
		images: [],
		description: "",
		fetchedAt: "2026-10-04T00:00:00.000Z",
		versions: [],
		status: "seen",
		analyses: [],
		interactions: [],
		...overrides,
	};
}

function profile(overrides: Partial<Profile> = {}): Profile {
	return {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: true,
		recheckHours: 48,
		...overrides,
	};
}

function input(overrides: Partial<FilterInput> = {}): FilterInput {
	return {
		offer: offer(),
		dwelling: dwelling(),
		profile: profile(),
		comparables: [],
		...overrides,
	};
}

describe("runFilters", () => {
	it("passes when no filter fails", () => {
		const run = runFilters(
			[{ filter: budgetFilter, missing: "fail" }],
			input(),
		);
		expect(run.passed).toBe(true);
		expect(run.verdicts).toEqual([
			{ filterId: "budget", outcome: "pass", reason: "" },
		]);
	});
	it("fails when a filter fails", () => {
		const pricey = input({
			offer: offer({
				price: { amount: 3000, currency: "EUR", period: "month" },
			}),
		});
		const run = runFilters(
			[{ filter: budgetFilter, missing: "fail" }],
			pricey,
		);
		expect(run.passed).toBe(false);
		expect(run.verdicts[0].outcome).toBe("fail");
	});
	it("converts a skip to a fail under missing:fail, keeps it under missing:skip", () => {
		const unknown = input({ dwelling: dwelling({ rooms: undefined }) });
		expect(
			runFilters([{ filter: bedroomsFilter, missing: "fail" }], unknown)
				.verdicts[0].outcome,
		).toBe("fail");
		expect(
			runFilters([{ filter: bedroomsFilter, missing: "skip" }], unknown)
				.verdicts[0].outcome,
		).toBe("skip");
	});
});

describe("built-in filters", () => {
	it("budget: passes within range, fails over and under", () => {
		expect(budgetFilter.evaluate(input())).toEqual({ outcome: "pass" });
		expect(
			budgetFilter.evaluate(
				input({
					offer: offer({
						price: {
							amount: 3000,
							currency: "EUR",
							period: "month",
						},
					}),
				}),
			).outcome,
		).toBe("fail");
		expect(
			budgetFilter.evaluate(
				input({
					profile: profile({
						budget: { max: 2200, min: 2100, currency: "EUR" },
					}),
				}),
			).outcome,
		).toBe("fail");
	});
	it("bedrooms: passes within range, skips when unknown", () => {
		expect(
			bedroomsFilter.evaluate(
				input({ profile: profile({ bedrooms: { min: 1, max: 3 } }) }),
			).outcome,
		).toBe("pass");
		expect(
			bedroomsFilter.evaluate(
				input({ dwelling: dwelling({ rooms: undefined }) }),
			).outcome,
		).toBe("skip");
	});
	it("location: passes on a matching area, fails otherwise", () => {
		expect(locationFilter.evaluate(input()).outcome).toBe("pass");
		expect(
			locationFilter.evaluate(
				input({ profile: profile({ areas: ["Cork"] }) }),
			).outcome,
		).toBe("fail");
	});
});
