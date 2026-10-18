import fs from "node:fs";
import Database from "better-sqlite3";
import { DEFAULT_MEMBER_ID } from "../../../../core/domain/member.js";
import { analysisTable } from "./analysis.js";
import { configTable } from "./config.js";
import { deadLetterTable } from "./dead-letter.js";
import { decisionTable } from "./decision.js";
import { dwellingTable } from "./dwelling.js";
import { feedTable } from "./feed.js";
import { feedCursorTable } from "./feed-cursor.js";
import { interactionTable } from "./interaction.js";
import { marketEventTable } from "./market-event.js";
import { memberTable } from "./member.js";
import { memberProfileTable } from "./member-profile.js";
import { offerTable } from "./offer.js";
import { offerVersionTable } from "./offer-version.js";
import { poolTable } from "./pool.js";
import { providersStateTable } from "./providers-state.js";
import { runTable } from "./run.js";
import { verdictTable } from "./verdict.js";

/** Persistence definition for one domain object. Owned by the store adapter. */
export interface TableDefinition {
	table: string;
	dependsOn: string[];
	createTable: string;
}

/** Ordered schema migrations. Applied once, in order, atomically. */
interface Migration {
	version: number;
	statements: string[] | ((database: Database.Database) => string[]);
}

const ENTITY_TABLES: TableDefinition[] = [
	dwellingTable,
	offerTable,
	offerVersionTable,
	memberTable,
	decisionTable,
	poolTable,
	feedTable,
	feedCursorTable,
	configTable,
	memberProfileTable,
	verdictTable,
	runTable,
	deadLetterTable,
	analysisTable,
	interactionTable,
	marketEventTable,
	providersStateTable,
];

/** Tables added after the original schema, in dependency order. */
const NEW_MODEL_TABLES: TableDefinition[] = [
	memberTable,
	decisionTable,
	poolTable,
	feedTable,
	feedCursorTable,
	configTable,
	memberProfileTable,
];

/** Seeds the built-in member the local CLI acts as. */
const SEED_DEFAULT_MEMBER = `
INSERT OR IGNORE INTO members (id, name, role, created_at)
SELECT '${DEFAULT_MEMBER_ID}', 'Local', 'admin', strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`;

/** The old statuses that were judgments, not filter results. */
const JUDGMENT_STATUSES =
	"'screened','shortlisted','rejected','held','let','sold','gone'";

/** Moves judgments and reactions into decisions. Filter-only rows stay out. */
const BACKFILL_DECISIONS = `
INSERT OR IGNORE INTO decisions (member_id, offer_id, market_status, user_status)
SELECT '${DEFAULT_MEMBER_ID}', id,
	CASE WHEN status IN (${JUDGMENT_STATUSES}) THEN status ELSE NULL END,
	user_status
FROM offers
WHERE status IN (${JUDGMENT_STATUSES}) OR user_status != 'none';`;

/** Offers that passed the old filter become the pool. */
const BACKFILL_POOL = `
INSERT OR IGNORE INTO pool (offer_id, entered_at)
SELECT id, fetched_at FROM offers WHERE status != 'seen';`;

/** The old queue becomes the feed: pending waited for judgment, passed flowed through. */
const BACKFILL_FEED = `
INSERT OR IGNORE INTO feed (member_id, offer_id, added_at, state)
SELECT '${DEFAULT_MEMBER_ID}', id, fetched_at,
	CASE WHEN status = 'pending' THEN 'to-evaluate' ELSE 'accepted' END
FROM offers WHERE status IN ('passed', 'pending');`;

/** Scopes recorded judgments and reactions to a member. Existing rows belong to the built-in member. */
const ADD_MEMBER_SCOPE = [
	`ALTER TABLE analyses ADD COLUMN member_id TEXT NOT NULL DEFAULT '${DEFAULT_MEMBER_ID}';`,
	`ALTER TABLE interactions ADD COLUMN member_id TEXT NOT NULL DEFAULT '${DEFAULT_MEMBER_ID}';`,
];

/** Drops the per-offer status columns now that decisions hold them. */
const DROP_OFFER_STATUS = [
	"ALTER TABLE offers DROP COLUMN status;",
	"ALTER TABLE offers DROP COLUMN user_status;",
];

/** The one existing-workspace upgrade: v1 to the multi-member model. */
const LEGACY_UPGRADE = [
	...ADD_MEMBER_SCOPE,
	BACKFILL_DECISIONS,
	BACKFILL_POOL,
	BACKFILL_FEED,
	...DROP_OFFER_STATUS,
];

const MIGRATIONS: Migration[] = [
	{
		version: 1,
		statements: orderTables(ENTITY_TABLES).map(
			(table) => table.createTable,
		),
	},
	{
		version: 2,
		statements: upgradeToNewModel,
	},
];

/** Creates the new tables when upgrading a v1 database, then seeds the built-in member. */
function upgradeToNewModel(database: Database.Database): string[] {
	const legacy = !hasTable(database, "members");
	return [
		...(legacy
			? orderTables(NEW_MODEL_TABLES).map((table) => table.createTable)
			: []),
		SEED_DEFAULT_MEMBER,
		...(legacy ? LEGACY_UPGRADE : []),
	];
}

function hasTable(database: Database.Database, table: string): boolean {
	const row: unknown = database
		.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
		)
		.get(table);
	return row !== undefined;
}

function latestVersion(): number {
	return MIGRATIONS.reduce(
		(max, migration) => Math.max(max, migration.version),
		0,
	);
}

/** Latest schema version. Derived from the migration list. */
export const SCHEMA_VERSION = latestVersion();

/** Orders table definitions so dependencies are created first. Tolerates unknown names, terminates on cycles. */
export function orderTables(tables: TableDefinition[]): TableDefinition[] {
	const byName = new Map(tables.map((table) => [table.table, table]));
	const ordered: TableDefinition[] = [];
	const visited = new Set<string>();
	for (const table of tables) visit(table);
	return ordered;

	function visit(table: TableDefinition): void {
		if (visited.has(table.table)) return;
		visited.add(table.table);
		for (const dependency of table.dependsOn) {
			const required = byName.get(dependency);
			if (required !== undefined) visit(required);
		}
		ordered.push(table);
	}
}

/** Applies pending migrations in order, atomically. Safe to run on every open. */
export function migrate(database: Database.Database): void {
	database.pragma("journal_mode = WAL");
	database.pragma("foreign_keys = ON");
	database.exec(
		"CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
	);
	const applied = readAppliedVersions(database);
	const pending = MIGRATIONS.filter(
		(migration) => !applied.has(migration.version),
	);
	const apply = database.transaction((waiting: Migration[]) => {
		for (const migration of waiting) {
			const statements =
				typeof migration.statements === "function"
					? migration.statements(database)
					: migration.statements;
			for (const statement of statements) database.exec(statement);
			database
				.prepare(
					"INSERT INTO _migrations (version, applied_at) VALUES (?, ?)",
				)
				.run(migration.version, new Date().toISOString());
		}
	});
	apply(pending);
}

function readAppliedVersions(database: Database.Database): Set<number> {
	const applied = new Set<number>();
	const records: unknown[] = database
		.prepare("SELECT version FROM _migrations")
		.all();
	for (const record of records) {
		if (
			typeof record === "object" &&
			record !== null &&
			"version" in record &&
			typeof record.version === "number"
		) {
			applied.add(record.version);
		}
	}
	return applied;
}

/** Reads the schema version without writing. Null when the file is missing. */
export function readSchemaVersion(databaseFile: string): number | null {
	if (!fs.existsSync(databaseFile)) return null;
	const database = new Database(databaseFile, { readonly: true });
	try {
		const tables: unknown[] = database
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_migrations'",
			)
			.all();
		if (tables.length === 0) return 0;
		const record: unknown = database
			.prepare("SELECT MAX(version) AS version FROM _migrations")
			.get();
		if (
			typeof record === "object" &&
			record !== null &&
			"version" in record &&
			typeof record.version === "number"
		) {
			return record.version;
		}
		return 0;
	} finally {
		database.close();
	}
}
