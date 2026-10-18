import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	closeStore,
	createSqliteStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";
import type { Profile } from "../src/core/schemas/profile.js";
import {
	getMemberProfile,
	readProfileValue,
	setMemberProfile,
	setProfileValue,
} from "../src/core/services/profile.service.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

function testStore(): ReturnType<typeof createSqliteStore> {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	const database = openStore(path.join(root, "housing.db"));
	cleanups.push(() => {
		closeStore(database);
		fs.rmSync(root, { recursive: true, force: true });
	});
	return createSqliteStore(database);
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

describe("member profile service", () => {
	it("reads and writes a stored member profile", async () => {
		const store = testStore();
		await store.writeMemberProfile(DEFAULT_MEMBER_ID, profile());
		expect(
			await getMemberProfile({
				store,
				memberId: DEFAULT_MEMBER_ID,
				path: "budget.max",
			}),
		).toEqual({ path: "budget.max", value: 2200 });
		const updated = await setMemberProfile({
			store,
			memberId: DEFAULT_MEMBER_ID,
			path: "budget.max",
			value: 2500,
		});
		expect(updated).toEqual({ path: "budget.max", value: 2500 });
	});

	it("does not write an invalid value", async () => {
		const store = testStore();
		await store.writeMemberProfile(DEFAULT_MEMBER_ID, profile());
		await expect(
			setMemberProfile({
				store,
				memberId: DEFAULT_MEMBER_ID,
				path: "budget.max",
				value: "lots",
			}),
		).rejects.toThrow(/invalid profile value/);
		expect(
			await getMemberProfile({
				store,
				memberId: DEFAULT_MEMBER_ID,
				path: "budget.max",
			}),
		).toEqual({ path: "budget.max", value: 2200 });
	});
});
