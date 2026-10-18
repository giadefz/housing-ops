import path from "node:path";

/** The workspace database, relative to the root. Owned by the SQLite adapter. */
export const DATABASE_FILE = "data/housing.db";

/** Absolute path to the workspace database under the given root. */
export function databasePath(root: string): string {
	return path.join(root, DATABASE_FILE);
}
