import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	closeStore,
	createSqliteStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import { ConfigNotFoundError } from "../src/core/errors/config.js";
import type { Config } from "../src/core/schemas/config.js";
import { getConfig, setConfig } from "../src/core/services/config.service.js";

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

describe("config service", () => {
	it("throws when the instance is not initialized", async () => {
		const store = testStore();
		await expect(getConfig({ store })).rejects.toBeInstanceOf(
			ConfigNotFoundError,
		);
	});

	it("validates, writes, and reads the config", async () => {
		const store = testStore();
		const config = configFixture();
		expect(await setConfig({ store, config })).toEqual(config);
		expect(await getConfig({ store })).toEqual(config);
	});
});
