import { describe, expect, it } from "vitest";
import {
	buildFilterStages,
	listFilters,
} from "../src/adapters/secondary/filters/registry.js";
import { ConfigError } from "../src/core/errors/config.js";

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

describe("listFilters", () => {
	it("lists stages, marking unknown ids unavailable", () => {
		expect(listFilters(valid)).toEqual([
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
		expect(listFilters(null)).toEqual([]);
	});
	it("throws ConfigError on malformed YAML", () => {
		expect(() => listFilters("version: [unclosed")).toThrow(ConfigError);
	});
});

describe("buildFilterStages", () => {
	it("keeps the enabled, known stages in order", () => {
		const stages = buildFilterStages(valid);
		expect(stages.map((stage) => stage.filter.id)).toEqual(["budget"]);
		expect(stages[0].missing).toBe("fail");
	});
});
