import type Database from "better-sqlite3";
import { ConfigSchema, type Config } from "../../../../core/schemas/config.js";
import type { TableDefinition } from "./migrate.js";
import { CorruptRecordError, requireJson } from "./record.js";

/** Config table. One row holding the shared, admin-editable config document. */
export const configTable: TableDefinition = {
	table: "config",
	dependsOn: [],
	createTable: `
CREATE TABLE config (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	document TEXT NOT NULL
);`,
};

/** Reads the shared config, or null when the instance has not been initialized. */
export async function readConfig(
	database: Database.Database,
): Promise<Config | null> {
	const row = database
		.prepare("SELECT document FROM config WHERE id = 1")
		.get() as { document: string } | undefined;
	if (row === undefined) return null;
	const document = requireJson<unknown>(
		"config",
		"1",
		"document",
		row.document,
	);
	const parsed = ConfigSchema.safeParse(document);
	if (!parsed.success)
		throw new CorruptRecordError("config", "1", parsed.error.message);
	return parsed.data;
}

/** Writes the shared config, replacing the previous document. */
export async function writeConfig(
	database: Database.Database,
	config: Config,
): Promise<void> {
	database
		.prepare(
			`INSERT INTO config (id, document) VALUES (1, ?)
			ON CONFLICT(id) DO UPDATE SET document = excluded.document`,
		)
		.run(JSON.stringify(config));
}
