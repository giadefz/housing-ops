import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { storeFactory } from "../src/adapters/secondary/store-factory.js";
import { SCHEMA_VERSION } from "../src/adapters/secondary/storage/sqlite/migrate.js";
import {
	closeStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import { StoreNotInitializedError } from "../src/core/errors/storage.js";

let roots: string[] = [];
afterEach(() => {
	for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
	roots = [];
});

function emptyRoot(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	roots.push(root);
	return root;
}

describe("storeFactory", () => {
	it("throws when the workspace has no database", () => {
		expect(() => storeFactory.open(emptyRoot())).toThrow(
			StoreNotInitializedError,
		);
	});
	it("opens a handle once the database exists", () => {
		const root = emptyRoot();
		fs.mkdirSync(path.join(root, "data"), { recursive: true });
		closeStore(openStore(path.join(root, "data", "housing.db")));
		const handle = storeFactory.open(root);
		expect(handle.store).toBeDefined();
		handle.close();
	});
});

describe("storeFactory.describe", () => {
	it("reports no schema version before the store exists", () => {
		expect(storeFactory.describe(emptyRoot())).toEqual({
			location: "data/housing.db",
			schemaVersion: null,
		});
	});
	it("reports the applied version once initialised", () => {
		const root = emptyRoot();
		storeFactory.init(root);
		expect(storeFactory.describe(root)).toEqual({
			location: "data/housing.db",
			schemaVersion: SCHEMA_VERSION,
		});
	});
});

describe("storeFactory.init", () => {
	it("creates the store and reports its location and version", () => {
		const root = emptyRoot();
		const description = storeFactory.init(root);
		expect(description.location).toBe("data/housing.db");
		expect(description.schemaVersion).toBe(SCHEMA_VERSION);
		expect(fs.existsSync(path.join(root, "data", "housing.db"))).toBe(true);
	});
});
