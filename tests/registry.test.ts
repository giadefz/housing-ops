import { describe, expect, it } from "vitest";
import {
	buildProviders,
	listProviderSummaries,
} from "../src/adapters/secondary/providers/registry.js";
import { ConfigError } from "../src/core/errors/config.js";

const valid = `
version: 1
providers:
  - id: fake
    type: process
    country: ie
    markets: [rent]
    command: echo
    output: jsonl
`;

describe("buildProviders", () => {
	it("builds a provider per entry, keyed by id", () => {
		const providers = buildProviders(valid);
		expect(providers.has("fake")).toBe(true);
		expect(providers.get("fake")?.markets).toEqual(["rent"]);
	});
	it("returns an empty map when there is no providers config", () => {
		expect(buildProviders(null).size).toBe(0);
	});
	it("throws ConfigError on an unknown provider type", () => {
		const bad = `
version: 1
providers:
  - id: x
    type: magic
    country: ie
    markets: [rent]
`;
		expect(() => buildProviders(bad)).toThrow(ConfigError);
	});
	it("throws ConfigError on malformed YAML", () => {
		expect(() => buildProviders("version: [unclosed")).toThrow(ConfigError);
	});
});

describe("listProviderSummaries", () => {
	it("lists the configured providers", () => {
		expect(listProviderSummaries(valid)).toEqual([
			{
				id: "fake",
				type: "process",
				country: "ie",
				markets: ["rent"],
				enabled: true,
			},
		]);
	});
	it("returns an empty list when there is no providers config", () => {
		expect(listProviderSummaries(null)).toEqual([]);
	});
});
