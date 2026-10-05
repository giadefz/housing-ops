import { describe, expect, it } from "vitest";
import {
	buildFilterStages,
	isFilterAvailable,
	listFilters,
} from "../src/adapters/secondary/filters/registry.js";
import { ConfigError } from "../src/core/errors/config.js";
import type { FilterPort } from "../src/core/ports/filter.port.js";

const valid = `
version: 1
filters:
  - id: budget
    enabled: true
    missing: fail
  - id: mystery
    enabled: true
  - id: location
    enabled: false
`;

function genericFilter(id: string): FilterPort {
	return { id, evaluate: () => ({ outcome: "pass" }) };
}

function countryFilter(id: string, country: string): FilterPort {
	return { id, country, evaluate: () => ({ outcome: "pass" }) };
}

describe("isFilterAvailable", () => {
	it("passes generic filters anywhere, country filters only in their country", () => {
		expect(isFilterAvailable(genericFilter("budget"), "ie")).toBe(true);
		expect(isFilterAvailable(genericFilter("budget"), "fr")).toBe(true);
		expect(isFilterAvailable(countryFilter("ber", "ie"), "ie")).toBe(true);
		expect(isFilterAvailable(countryFilter("ber", "ie"), "fr")).toBe(false);
		expect(isFilterAvailable(undefined, "ie")).toBe(false);
	});
});

describe("listFilters", () => {
	it("lists stages, marking unknown ids unavailable", () => {
		expect(listFilters(valid, "ie")).toEqual([
			{ id: "budget", enabled: true, missing: "fail", available: true },
			{ id: "mystery", enabled: true, missing: "skip", available: false },
			{
				id: "location",
				enabled: false,
				missing: "skip",
				available: true,
			},
		]);
	});
	it("returns nothing without pipeline.yml", () => {
		expect(listFilters(null, "ie")).toEqual([]);
	});
	it("throws ConfigError on malformed YAML", () => {
		expect(() => listFilters("version: [unclosed", "ie")).toThrow(
			ConfigError,
		);
	});
});

describe("buildFilterStages", () => {
	it("keeps the enabled, known stages in order", () => {
		const stages = buildFilterStages(valid, "ie");
		expect(stages.map((stage) => stage.filter.id)).toEqual(["budget"]);
		expect(stages[0].missing).toBe("fail");
	});
});
