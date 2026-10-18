import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { storeFactory } from "../src/adapters/secondary/store-factory.js";
import { initDatabase } from "../src/adapters/secondary/storage/sqlite/init.js";
import { SCHEMA_VERSION } from "../src/adapters/secondary/storage/sqlite/migrate.js";
import {
	readWorkspace,
	writeWorkspace,
} from "../src/adapters/secondary/workspace.js";
import { CONFIG_FILES, SetupInputSchema } from "../src/core/schemas/index.js";
import { planWorkspace } from "../src/core/services/setup.service.js";
import { validateWorkspace } from "../src/core/services/validate.service.js";

const documents = {
	"profile.yml": {
		version: 1,
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
	},
	"pipeline.yml": {
		version: 1,
		filters: [{ id: "budget", enabled: true, missing: "skip" }],
	},
	"providers.yml": { version: 1, providers: [] },
	"publishers.yml": { version: 1, publishers: [] },
	"extensions.yml": { version: 1, approvals: [] },
};

const plan = planWorkspace(SetupInputSchema.parse(documents));

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

function read(root: string) {
	return readWorkspace({
		root,
		store: storeFactory.describe(root),
		expectedSchemaVersion: storeFactory.targetSchemaVersion,
	});
}

describe("writeWorkspace", () => {
	it("writes all five config documents under config/", () => {
		const root = emptyRoot();
		writeWorkspace(root, plan);
		for (const file of CONFIG_FILES) {
			expect(fs.existsSync(path.join(root, "config", file))).toBe(true);
		}
		const workspace = read(root);
		for (const file of CONFIG_FILES) {
			expect(workspace.configTexts[file]).not.toBeNull();
		}
	});
});

describe("initDatabase", () => {
	it("creates the database at the workspace schema version", () => {
		const root = emptyRoot();
		initDatabase(root);
		const workspace = read(root);
		expect(workspace.store.schemaVersion).toBe(SCHEMA_VERSION);
	});

	it("is idempotent", () => {
		const root = emptyRoot();
		initDatabase(root);
		expect(() => initDatabase(root)).not.toThrow();
	});
});

describe("setup end state", () => {
	it("leaves a workspace that validates all green", () => {
		const root = emptyRoot();
		writeWorkspace(root, plan);
		initDatabase(root);
		const findings = validateWorkspace(read(root)).findings;
		expect(findings.filter((finding) => !finding.ok)).toEqual([]);
	});
});
