import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
	closeStore,
	createSqliteStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";
import type { Config } from "../src/core/schemas/config.js";
import type { Profile } from "../src/core/schemas/profile.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

function testStore(): {
	database: Database.Database;
	store: ReturnType<typeof createSqliteStore>;
} {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	const database = openStore(path.join(root, "housing.db"));
	cleanups.push(() => {
		closeStore(database);
		fs.rmSync(root, { recursive: true, force: true });
	});
	return { database, store: createSqliteStore(database) };
}

function configFixture(): Config {
	return {
		pipeline: {
			version: 1,
			filters: [{ id: "budget", enabled: true, missing: "skip" }],
		},
		providers: { version: 1, providers: [] },
		publishers: { version: 1, publishers: [] },
	};
}

function profileFixture(): Profile {
	return {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: true,
		recheckHours: 48,
	};
}

describe("shared config storage", () => {
	it("returns null before initialization, then round-trips", async () => {
		const { store } = testStore();
		expect(await store.readConfig()).toBeNull();
		const config = configFixture();
		await store.writeConfig(config);
		expect(await store.readConfig()).toEqual(config);
	});

	it("replaces the previous config", async () => {
		const { store } = testStore();
		await store.writeConfig(configFixture());
		const empty: Config = {
			pipeline: { version: 1, filters: [] },
			providers: { version: 1, providers: [] },
			publishers: { version: 1, publishers: [] },
		};
		await store.writeConfig(empty);
		expect(await store.readConfig()).toEqual(empty);
	});

	it("throws on a corrupt document", async () => {
		const { database, store } = testStore();
		database
			.prepare("INSERT INTO config (id, document) VALUES (1, ?)")
			.run("{not json");
		await expect(store.readConfig()).rejects.toThrow(/corrupt config/);
	});
});

describe("member profile storage", () => {
	it("round-trips a profile", async () => {
		const { store } = testStore();
		const profile = profileFixture();
		await store.writeMemberProfile(DEFAULT_MEMBER_ID, profile);
		expect(await store.readMemberProfile(DEFAULT_MEMBER_ID)).toEqual(
			profile,
		);
	});

	it("returns null for a member without a profile", async () => {
		const { store } = testStore();
		expect(await store.readMemberProfile("missing")).toBeNull();
	});

	it("throws on a corrupt profile", async () => {
		const { database, store } = testStore();
		database
			.prepare(
				"INSERT INTO member_profiles (member_id, profile) VALUES (?, ?)",
			)
			.run(DEFAULT_MEMBER_ID, "{not json");
		await expect(
			store.readMemberProfile(DEFAULT_MEMBER_ID),
		).rejects.toThrow(/corrupt member_profiles/);
	});
});
