import { describe, expect, it } from "vitest";
import {
	InteractionInputSchema,
	ProfileGetSchema,
	ProfileSetSchema,
	QueueInputSchema,
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

describe("QueueInputSchema", () => {
	it("defaults status and limit", () => {
		expect(QueueInputSchema.parse({})).toEqual({
			status: "pending",
			limit: 20,
		});
	});
	it("rejects an unknown status and a non-positive limit", () => {
		expect(QueueInputSchema.safeParse({ status: "nope" }).success).toBe(
			false,
		);
		expect(QueueInputSchema.safeParse({ limit: 0 }).success).toBe(false);
	});
});

describe("profile schemas", () => {
	it("allows an omitted path on get", () => {
		expect(ProfileGetSchema.parse({})).toEqual({});
	});
	it("accepts any JSON value on set", () => {
		expect(
			ProfileSetSchema.parse({ path: "budget.max", value: 2300 }),
		).toEqual({ path: "budget.max", value: 2300 });
	});
	it("rejects an empty path on set", () => {
		expect(ProfileSetSchema.safeParse({ path: "", value: 1 }).success).toBe(
			false,
		);
	});
});
