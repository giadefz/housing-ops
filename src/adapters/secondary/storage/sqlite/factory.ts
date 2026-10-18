import fs from "node:fs";
import { StoreNotInitializedError } from "../../../../core/errors/storage.js";
import type {
	StoreDescription,
	StoreFactory,
	StoreHandle,
} from "../../../../core/ports/store.port.js";
import { initDatabase } from "./init.js";
import { DATABASE_FILE, databasePath } from "./location.js";
import { readSchemaVersion, SCHEMA_VERSION } from "./migrate.js";
import { closeStore, createSqliteStore, openStore } from "./store.js";

/** Opens, creates, and describes the workspace SQLite database. */
export const sqliteStoreFactory: StoreFactory = {
	targetSchemaVersion: SCHEMA_VERSION,
	open(workspaceRoot: string): StoreHandle {
		const file = databasePath(workspaceRoot);
		if (!fs.existsSync(file))
			throw new StoreNotInitializedError(workspaceRoot);
		const database = openStore(file);
		return {
			store: createSqliteStore(database),
			close: () => closeStore(database),
		};
	},
	describe(workspaceRoot: string): StoreDescription {
		return {
			location: DATABASE_FILE,
			schemaVersion: readSchemaVersion(databasePath(workspaceRoot)),
		};
	},
	init(workspaceRoot: string): StoreDescription {
		return initDatabase(workspaceRoot);
	},
};
