import { describe, expect, it } from "vitest";
import {
	CONFIG_FILES,
	ConfigSchemas,
	SetupInputSchema,
	type SetupInput,
} from "../src/core/schemas/index.js";
import { planWorkspace } from "../src/core/services/setup.service.js";

const documents = {
	"profile.yml": {
		version: 1,
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Ranelagh"],
	},
	"pipeline.yml": {
		version: 1,
		filters: [{ id: "budget", enabled: true, missing: "skip" }],
	},
	"providers.yml": { version: 1, providers: [] },
	"publishers.yml": { version: 1, publishers: [] },
	"extensions.yml": { version: 1, approvals: [] },
};

const input = SetupInputSchema.parse(documents);

describe("planWorkspace", () => {
	it("returns each document validated against its config schema", () => {
		const plan = planWorkspace(input);
		expect(Object.keys(plan).sort()).toEqual([...CONFIG_FILES].sort());
		for (const file of CONFIG_FILES) {
			expect(ConfigSchemas[file].safeParse(plan[file]).success).toBe(
				true,
			);
		}
	});

	it("passes the documents through unchanged when already valid", () => {
		const plan = planWorkspace(input);
		expect(plan["profile.yml"]).toMatchObject({
			market: "rent",
			country: "ie",
			budget: { max: 2200, currency: "EUR" },
		});
		expect(plan["providers.yml"]).toEqual({ version: 1, providers: [] });
	});

	it("rejects a malformed document", () => {
		const bad: SetupInput = {
			...input,
			"profile.yml": { version: 1, market: "lease" },
		};
		expect(() => planWorkspace(bad)).toThrow();
	});

	it("rejects a missing document", () => {
		const partial = { ...input } as Record<string, unknown>;
		delete partial["providers.yml"];
		expect(() => planWorkspace(partial as SetupInput)).toThrow();
	});

	it("requires all five documents at the boundary", () => {
		expect(SetupInputSchema.safeParse({ "profile.yml": {} }).success).toBe(
			false,
		);
	});
});
