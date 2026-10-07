import { describe, expect, it } from "vitest";
import type { Profile } from "../src/core/schemas/profile.js";
import {
	readProfileValue,
	setProfileValue,
} from "../src/core/services/profile.service.js";

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

describe("readProfileValue", () => {
	it("returns the whole profile without a path", () => {
		expect(readProfileValue(profile())).toMatchObject({ market: "rent" });
	});
	it("returns a nested value", () => {
		expect(readProfileValue(profile(), "budget.max")).toBe(2200);
	});
	it("throws on an unknown path", () => {
		expect(() => readProfileValue(profile(), "nope.deep")).toThrow(
			/not found/,
		);
	});
});

describe("setProfileValue", () => {
	it("sets a nested value without mutating the original", () => {
		const original = profile();
		const updated = setProfileValue(original, "budget.max", 2500);
		expect(updated.budget.max).toBe(2500);
		expect(original.budget.max).toBe(2200);
	});
	it("sets an array value", () => {
		const updated = setProfileValue(profile(), "areas", [
			"Dublin 2",
			"Dublin 4",
		]);
		expect(updated.areas).toEqual(["Dublin 2", "Dublin 4"]);
	});
	it("rejects a value that fails the schema", () => {
		expect(() => setProfileValue(profile(), "budget.max", "lots")).toThrow(
			/invalid profile value/,
		);
	});
});
