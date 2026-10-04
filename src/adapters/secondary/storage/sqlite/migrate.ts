import fs from "node:fs";
import Database from "better-sqlite3";
import { analysisTable } from "./analysis.js";
import { deadLetterTable } from "./dead-letter.js";
import { dwellingTable } from "./dwelling.js";
import { interactionTable } from "./interaction.js";
import { marketEventTable } from "./market-event.js";
import { offerTable } from "./offer.js";
import { offerVersionTable } from "./offer-version.js";
import { providersStateTable } from "./providers-state.js";
import { runTable } from "./run.js";
import { verdictTable } from "./verdict.js";

/** Persistence definition for one domain object. Owned by the store adapter. */
export interface TableDefinition {
	table: string;
	dependsOn: string[];
	createTable: string;
}

/** Ordered schema migrations. Additive only: history is never rewritten. */
interface Migration {
	version: number;
	statements: string[];
}

const ENTITY_TABLES: TableDefinition[] = [
	dwellingTable,
	offerTable,
	offerVersionTable,
	verdictTable,
	runTable,
	deadLetterTable,
	analysisTable,
	interactionTable,
	marketEventTable,
	providersStateTable,
];

const MIGRATIONS: Migration[] = [
	{
		version: 1,
		statements: orderTables(ENTITY_TABLES).map(
			(table) => table.createTable,
		),
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
