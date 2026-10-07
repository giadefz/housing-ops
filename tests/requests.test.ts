import { describe, expect, it } from "vitest";
import {
	InteractionInputSchema,
	VerdictInputSchema,
} from "../src/core/schemas/requests.js";

describe("VerdictInputSchema", () => {
	it("parses a triage judgment", () => {
		expect(
			VerdictInputSchema.parse({
				tier: "triage",
				verdict: "screened",
				reason: "worth a look",
			}),
		).toEqual({
			tier: "triage",
			verdict: "screened",
			reason: "worth a look",
		});
	});
	it("rejects an unknown tier or verdict", () => {
		expect(
			VerdictInputSchema.safeParse({
				tier: "deep",
				verdict: "reject",
				reason: "x",
			}).success,
		).toBe(false);
		expect(
			VerdictInputSchema.safeParse({
				tier: "triage",
				verdict: "maybe",
				reason: "x",
			}).success,
		).toBe(false);
	});
	it("rejects a missing reason and an out-of-range confidence", () => {
		expect(
			VerdictInputSchema.safeParse({ tier: "triage", verdict: "reject" })
				.success,
		).toBe(false);
		expect(
			VerdictInputSchema.safeParse({
				tier: "analyse",
				verdict: "shortlist",
				reason: "x",
				confidence: 2,
			}).success,
		).toBe(false);
	});
});

describe("InteractionInputSchema", () => {
	it("parses an action", () => {
		expect(InteractionInputSchema.parse({ action: "favorited" })).toEqual({
			action: "favorited",
		});
	});
	it("rejects an unknown action", () => {
		expect(
			InteractionInputSchema.safeParse({ action: "loved" }).success,
		).toBe(false);
	});
});
