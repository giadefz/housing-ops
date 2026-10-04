import fs from "node:fs";
import { StoreNotInitializedError } from "../../../../core/errors.js";
import type {
	StoreFactory,
	StoreHandle,
} from "../../../../core/ports/store.port.js";
import { databasePath } from "../../workspace.js";
import { closeStore, createSqliteStore, openStore } from "./store.js";

/** Opens the workspace SQLite database. Throws when the workspace has no database yet. */
export const sqliteStoreFactory: StoreFactory = {
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
};
