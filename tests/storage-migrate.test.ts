import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
	SCHEMA_VERSION,
	migrate,
	readSchemaVersion,
} from "../src/adapters/secondary/storage/sqlite/migrate.js";

let roots: string[] = [];
afterEach(() => {
	for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
	roots = [];
});

function databaseFile(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	roots.push(root);
	return path.join(root, "housing.db");
}

function tableNames(databaseFile: string): string[] {
	const database = new Database(databaseFile, { readonly: true });
	try {
		const rows: unknown[] = database
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
			)
			.all();
		const names: string[] = [];
		for (const row of rows) {
			if (
				typeof row === "object" &&
				row !== null &&
				"name" in row &&
				typeof row.name === "string"
			) {
				names.push(row.name);
			}
		}
		return names.sort();
	} finally {
		database.close();
	}
}

describe("migrate", () => {
	it("creates every documented table on an empty database", () => {
		const file = databaseFile();
		const database = new Database(file);
		try {
			migrate(database);
		} finally {
			database.close();
		}
		expect(tableNames(file)).toEqual([
			"_migrations",
			"analyses",
			"dead_letter",
			"decisions",
			"dwellings",
			"interactions",
			"market_events",
			"members",
			"offer_versions",
			"offers",
			"providers_state",
			"runs",
			"verdicts",
		]);
	});
	it("is a no-op on the second run", () => {
		const file = databaseFile();
		const database = new Database(file);
		try {
			migrate(database);
			migrate(database);
		} finally {
			database.close();
		}
		expect(readSchemaVersion(file)).toBe(SCHEMA_VERSION);
	});
});

describe("readSchemaVersion", () => {
	it("reports null for a missing file", () => {
		expect(readSchemaVersion("/nonexistent/housing.db")).toBeNull();
	});
	it("reports zero for a database without migrations", () => {
		const file = databaseFile();
		const database = new Database(file);
		database.close();
		expect(readSchemaVersion(file)).toBe(0);
	});
	it("reports the migrated version", () => {
		const file = databaseFile();
		const database = new Database(file);
		try {
			migrate(database);
		} finally {
			database.close();
		}
		expect(readSchemaVersion(file)).toBe(SCHEMA_VERSION);
		expect(SCHEMA_VERSION).toBeGreaterThan(0);
	});
});
