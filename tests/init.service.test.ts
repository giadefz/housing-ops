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
import type { Instance } from "../src/core/schemas/instance.js";
import type { InitInput } from "../src/core/schemas/init.js";
import { initWorkspace } from "../src/core/services/init.service.js";

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

function initFixture(): InitInput {
	return {
		instance: {
			version: 1,
			name: "Home",
			country: "ie",
			market: "rent",
			interfaces: ["cli"],
		},
		profile: {
			market: "rent",
			country: "ie",
			budget: { max: 2200, currency: "EUR" },
			areas: ["Dublin 8"],
			gate: true,
			recheckHours: 48,
		},
		config: {
			pipeline: {
				version: 1,
				filters: [{ id: "budget", enabled: true, missing: "skip" }],
			},
			providers: { version: 1, providers: [] },
			publishers: { version: 1, publishers: [] },
		},
	};
}

describe("initWorkspace", () => {
	it("writes the instance, config, and admin profile", async () => {
		const store = testStore();
		const written: Instance[] = [];
		const input = initFixture();
		const result = await initWorkspace({
			input,
			force: false,
			writeInstance: (instance) => written.push(instance),
			store,
			database: "data/housing.db",
		});
		expect(written).toEqual([input.instance]);
		expect(result).toEqual({
			instance: input.instance,
			database: "data/housing.db",
		});
		expect(await store.readConfig()).toEqual(input.config);
		expect(await store.readMemberProfile(DEFAULT_MEMBER_ID)).toEqual(
			input.profile,
		);
	});

	it("does not write the store when the instance already exists", async () => {
		const store = testStore();
		await expect(
			initWorkspace({
				input: initFixture(),
				force: false,
				writeInstance: () => {
					throw new Error("instance exists");
				},
				store,
				database: "data/housing.db",
			}),
		).rejects.toThrow(/instance exists/);
		expect(await store.readConfig()).toBeNull();
	});
});
