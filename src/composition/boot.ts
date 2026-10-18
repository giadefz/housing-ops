import { readStoreSnapshot } from "./store.js";
import type { ApplicationDependencies, Boot } from "./types.js";

/** Reads the store snapshot and the workspace files, after any schema migration. */
export async function bootApplication(
	root: string,
	dependencies: ApplicationDependencies,
): Promise<Boot> {
	const snapshot = await readStoreSnapshot(dependencies.storeFactory, root);
	const workspace = dependencies.readWorkspaceFiles({
		root,
		store: dependencies.storeFactory.describe(root),
		expectedSchemaVersion: dependencies.storeFactory.targetSchemaVersion,
	});
	return { ...snapshot, workspace };
}
