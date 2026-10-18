import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { decisionTable } from "../src/adapters/secondary/storage/sqlite/decision.js";
import { dwellingTable } from "../src/adapters/secondary/storage/sqlite/dwelling.js";
import { memberTable } from "../src/adapters/secondary/storage/sqlite/member.js";
import {
	SCHEMA_VERSION,
	migrate,
	readSchemaVersion,
} from "../src/adapters/secondary/storage/sqlite/migrate.js";
import { offerTable } from "../src/adapters/secondary/storage/sqlite/offer.js";

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

describe("v2 to v3 upgrade", () => {
	function v2Database(file: string): Database.Database {
		const database = new Database(file);
		database.exec(
			`CREATE TABLE _migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
			INSERT INTO _migrations (version, applied_at) VALUES (1, 'x'), (2, 'x');`,
		);
		for (const table of [
			dwellingTable,
			offerTable,
			memberTable,
			decisionTable,
		]) {
			database.exec(table.createTable);
		}
		database.exec(
			`CREATE TABLE analyses (id TEXT PRIMARY KEY);
			CREATE TABLE interactions (id TEXT PRIMARY KEY);`,
		);
		database.exec(
			`INSERT INTO dwellings (id, address_key, address, layout, attributes)
			VALUES ('dw', 'k', '{"freeText":"x"}', 'apartment', '{}');
			INSERT INTO offers (id, dwelling_id, provider, listing_id, url, market, price, images, fetched_at, status, user_status)
			VALUES ('o1', 'dw', 'daft', 'l1', 'u', 'rent', '{"amount":1000,"currency":"EUR","period":"month"}', '[]', 't', 'shortlisted', 'viewing_requested');
			INSERT INTO members (id, name, role, created_at) VALUES ('local', 'Local', 'admin', 't');
			INSERT INTO decisions (member_id, offer_id, market_status, user_status)
			VALUES ('local', 'o1', 'pending', 'favorited');`,
		);
		return database;
	}

	it("re-syncs statuses written after v2 before dropping the offer columns", () => {
		const file = databaseFile();
		const database = v2Database(file);
		try {
			migrate(database);
			expect(
				database
					.prepare(
						"SELECT market_status, user_status FROM decisions WHERE member_id = 'local' AND offer_id = 'o1'",
					)
					.get(),
			).toEqual({
				market_status: "shortlisted",
				user_status: "viewing_requested",
			});
			const offerColumns = columnNames(database, "offers");
			expect(offerColumns).not.toContain("status");
			expect(offerColumns).not.toContain("user_status");
			expect(columnNames(database, "analyses")).toContain("member_id");
			expect(columnNames(database, "interactions")).toContain(
				"member_id",
			);
		} finally {
			database.close();
		}
	});
});

function columnNames(database: Database.Database, table: string): string[] {
	const rows: unknown[] = database
		.prepare(`SELECT name FROM pragma_table_info('${table}')`)
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
	return names;
}

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
