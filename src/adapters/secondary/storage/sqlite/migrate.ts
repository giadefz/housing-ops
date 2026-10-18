import fs from "node:fs";
import Database from "better-sqlite3";
import { DEFAULT_MEMBER_ID } from "../../../../core/domain/member.js";
import { analysisTable } from "./analysis.js";
import { deadLetterTable } from "./dead-letter.js";
import { decisionTable } from "./decision.js";
import { dwellingTable } from "./dwelling.js";
import { feedTable } from "./feed.js";
import { interactionTable } from "./interaction.js";
import { marketEventTable } from "./market-event.js";
import { memberTable } from "./member.js";
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
	statements: string[];
}

const ENTITY_TABLES: TableDefinition[] = [
	dwellingTable,
	offerTable,
	offerVersionTable,
	poolTable,
	feedTable,
	verdictTable,
	runTable,
	deadLetterTable,
	analysisTable,
	interactionTable,
	marketEventTable,
	providersStateTable,
];

/** Seeds the built-in member the local CLI acts as. */
const SEED_DEFAULT_MEMBER = `
INSERT INTO members (id, name, role, created_at)
SELECT '${DEFAULT_MEMBER_ID}', 'Local', 'admin', strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`;

/** Gives every existing offer a decision for the built-in member. */
const BACKFILL_DECISIONS = `
INSERT OR IGNORE INTO decisions (member_id, offer_id, market_status, user_status)
SELECT '${DEFAULT_MEMBER_ID}', id, status, user_status FROM offers;`;

/** Re-projects every offer's status into its decision, so statuses written after v2 survive the drop. */
const RESYNC_DECISIONS = `
INSERT INTO decisions (member_id, offer_id, market_status, user_status)
SELECT '${DEFAULT_MEMBER_ID}', id, status, user_status FROM offers WHERE true
ON CONFLICT(member_id, offer_id) DO UPDATE SET
market_status = excluded.market_status, user_status = excluded.user_status;`;

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

const MIGRATIONS: Migration[] = [
	{
		version: 1,
		statements: orderTables(ENTITY_TABLES).map(
			(table) => table.createTable,
		),
	},
	{
		version: 2,
		statements: [
			memberTable.createTable,
			SEED_DEFAULT_MEMBER,
			decisionTable.createTable,
			BACKFILL_DECISIONS,
		],
	},
	{
		version: 3,
		statements: [
			RESYNC_DECISIONS,
			...ADD_MEMBER_SCOPE,
			...DROP_OFFER_STATUS,
		],
	},
];

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
			for (const statement of migration.statements)
				database.exec(statement);
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
