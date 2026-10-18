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
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";

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

function tableNames(file: string): string[] {
	const database = new Database(file, { readonly: true });
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
			"config",
			"dead_letter",
			"decisions",
			"dwellings",
			"feed",
			"feed_cursor",
			"interactions",
			"market_events",
			"member_profiles",
			"members",
			"offer_versions",
			"offers",
			"pool",
			"providers_state",
			"runs",
			"verdicts",
		]);
	});

	it("seeds the built-in member", () => {
		const file = databaseFile();
		const database = new Database(file);
		try {
			migrate(database);
			expect(database.prepare("SELECT id FROM members").all()).toEqual([
				{ id: DEFAULT_MEMBER_ID },
			]);
		} finally {
			database.close();
		}
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

describe("v1 to v2 upgrade", () => {
	function v1Database(file: string): Database.Database {
		const database = new Database(file);
		database.exec(`
			CREATE TABLE _migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
			INSERT INTO _migrations (version, applied_at) VALUES (1, 'x');
			CREATE TABLE dwellings (
				id TEXT PRIMARY KEY,
				address_key TEXT NOT NULL UNIQUE,
				address TEXT NOT NULL,
				size TEXT,
				rooms TEXT,
				layout TEXT NOT NULL,
				year_built INTEGER,
				floor INTEGER,
				floors_total INTEGER,
				attributes TEXT NOT NULL
			);
			CREATE TABLE offers (
				id TEXT PRIMARY KEY,
				dwelling_id TEXT NOT NULL REFERENCES dwellings(id),
				provider TEXT NOT NULL,
				listing_id TEXT NOT NULL,
				url TEXT NOT NULL,
				market TEXT NOT NULL,
				price TEXT NOT NULL,
				images TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT '',
				posted_at TEXT,
				fetched_at TEXT NOT NULL,
				status TEXT NOT NULL,
				user_status TEXT NOT NULL DEFAULT 'none',
				UNIQUE(provider, listing_id)
			);
			CREATE TABLE analyses (
				id TEXT PRIMARY KEY,
				offer_id TEXT NOT NULL REFERENCES offers(id),
				tier TEXT NOT NULL,
				verdict TEXT NOT NULL,
				reason TEXT NOT NULL DEFAULT '',
				pros TEXT NOT NULL,
				cons TEXT NOT NULL,
				price_assessment TEXT,
				red_flags TEXT,
				recommendation TEXT,
				confidence REAL,
				author TEXT NOT NULL,
				created_at TEXT NOT NULL
			);
			CREATE TABLE interactions (
				id TEXT PRIMARY KEY,
				offer_id TEXT NOT NULL REFERENCES offers(id),
				action TEXT NOT NULL,
				reason TEXT,
				created_at TEXT NOT NULL
			);
			INSERT INTO dwellings (id, address_key, address, layout, attributes)
			VALUES ('dw', 'k', '{"freeText":"x"}', 'apartment', '{}');
			INSERT INTO offers (id, dwelling_id, provider, listing_id, url, market, price, images, fetched_at, status, user_status)
			VALUES
				('o1', 'dw', 'daft', 'l1', 'u', 'rent',
					'{"amount":1000,"currency":"EUR","period":"month"}', '[]', 't',
					'shortlisted', 'viewing_requested'),
				('o2', 'dw', 'daft', 'l2', 'u', 'rent',
					'{"amount":1000,"currency":"EUR","period":"month"}', '[]', 't',
					'seen', 'none'),
				('o3', 'dw', 'daft', 'l3', 'u', 'rent',
					'{"amount":1000,"currency":"EUR","period":"month"}', '[]', 't',
					'pending', 'none'),
				('o4', 'dw', 'daft', 'l4', 'u', 'rent',
					'{"amount":1000,"currency":"EUR","period":"month"}', '[]', 't',
					'passed', 'viewed'),
				('o5', 'dw', 'daft', 'l5', 'u', 'rent',
					'{"amount":1000,"currency":"EUR","period":"month"}', '[]', 't',
					'seen', 'favorited'),
				('o6', 'dw', 'daft', 'l6', 'u', 'rent',
					'{"amount":1000,"currency":"EUR","period":"month"}', '[]', 't',
					'rejected', 'none');
			INSERT INTO analyses (id, offer_id, tier, verdict, reason, pros, cons, author, created_at)
			VALUES ('a1', 'o1', 'triage', 'keep', '', '[]', '[]', 'ai', 't');
			INSERT INTO interactions (id, offer_id, action, created_at)
			VALUES ('i1', 'o1', 'viewed', 't');
		`);
		return database;
	}

	it("creates the new tables and moves statuses into decisions", () => {
		const file = databaseFile();
		const database = v1Database(file);
		try {
			migrate(database);
			expect(
				database
					.prepare(
						"SELECT offer_id, market_status, user_status FROM decisions WHERE member_id = ? ORDER BY offer_id",
					)
					.all(DEFAULT_MEMBER_ID),
			).toEqual([
				{
					offer_id: "o1",
					market_status: "shortlisted",
					user_status: "viewing_requested",
				},
				{ offer_id: "o4", market_status: null, user_status: "viewed" },
				{
					offer_id: "o5",
					market_status: null,
					user_status: "favorited",
				},
				{
					offer_id: "o6",
					market_status: "rejected",
					user_status: "none",
				},
			]);
			expect(
				database
					.prepare("SELECT offer_id FROM pool ORDER BY offer_id")
					.all(),
			).toEqual([
				{ offer_id: "o1" },
				{ offer_id: "o3" },
				{ offer_id: "o4" },
				{ offer_id: "o6" },
			]);
			expect(
				database
					.prepare(
						"SELECT offer_id, added_at, state FROM feed ORDER BY offer_id",
					)
					.all(),
			).toEqual([
				{ offer_id: "o3", added_at: "t", state: "to-evaluate" },
				{ offer_id: "o4", added_at: "t", state: "accepted" },
			]);
			expect(database.prepare("SELECT id FROM members").all()).toEqual([
				{ id: DEFAULT_MEMBER_ID },
			]);
			expect(tableNames(file)).toEqual(
				expect.arrayContaining([
					"config",
					"decisions",
					"feed",
					"feed_cursor",
					"member_profiles",
					"members",
					"pool",
				]),
			);
			const offerColumns = columnNames(database, "offers");
			expect(offerColumns).not.toContain("status");
			expect(offerColumns).not.toContain("user_status");
			expect(columnNames(database, "analyses")).toContain("member_id");
			expect(columnNames(database, "interactions")).toContain(
				"member_id",
			);
			expect(
				database
					.prepare("SELECT member_id FROM analyses WHERE id = 'a1'")
					.get(),
			).toEqual({ member_id: DEFAULT_MEMBER_ID });
			expect(
				database
					.prepare(
						"SELECT member_id FROM interactions WHERE id = 'i1'",
					)
					.get(),
			).toEqual({ member_id: DEFAULT_MEMBER_ID });
		} finally {
			database.close();
		}
	});

	it("is a no-op on the second run", () => {
		const file = databaseFile();
		const database = v1Database(file);
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
