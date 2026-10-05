import { describe, expect, it } from "vitest";
import { profileCoverageWarnings } from "../src/adapters/secondary/filters/coverage.js";
import { budgetFilter } from "../src/core/filters/budget.js";
import { typeFilter } from "../src/core/filters/type.js";
import type { Profile } from "../src/core/schemas/profile.js";
import type { FilterStage } from "../src/core/services/pipeline.service.js";

function profile(overrides: Partial<Profile> = {}): Profile {
	return {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: false,
		recheckHours: 48,
		...overrides,
	};
}

function stage(filter: FilterStage["filter"]): FilterStage {
	return { filter, missing: "skip" };
}

describe("profileCoverageWarnings", () => {
	it("warns when a filter reads a profile field that is not set", () => {
		expect(
			profileCoverageWarnings(
				[stage(typeFilter)],
				profile({ layouts: undefined }),
			),
		).toContain('filter "type" reads profile.layouts, which is not set');
	});
	it("warns when a set profile field has no enabled filter", () => {
		expect(profileCoverageWarnings([], profile())).toContain(
			"profile.budget is set but no enabled filter reads it (ignored)",
		);
	});
	it("does not warn when every set field is read", () => {
		expect(
			profileCoverageWarnings(
				[stage(budgetFilter)],
				profile({ areas: [] }),
			),
		).toEqual([]);
	});
});
