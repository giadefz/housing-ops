import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { storeFactory } from "../src/adapters/secondary/store-factory.js";
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
