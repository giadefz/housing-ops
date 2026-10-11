import {
	CONFIG_FILES,
	ConfigSchemas,
	type ConfigFile,
	type SetupInput,
} from "../schemas/index.js";
import type { SetupResult } from "../ports/application.port.js";

/** The five config files `setup` writes, each document validated against its schema. */
export type WorkspacePlan = Record<ConfigFile, unknown>;

/** One request to set up a workspace: the documents, the guard, and the two writers. */
export interface SetupRequest {
	input: SetupInput;
	force: boolean;
	write: (plan: WorkspacePlan, force: boolean) => void;
	initDatabase: () => string;
}

/** Validates the config documents, writes them, and initialises the database. */
export function setupWorkspace(request: SetupRequest): SetupResult {
	const { input, force, write, initDatabase } = request;
	write(planWorkspace(input), force);
	return { files: [...CONFIG_FILES], database: initDatabase() };
}

/** Validates a setup request into a workspace plan. Pure. */
export function planWorkspace(input: SetupInput): WorkspacePlan {
	return Object.fromEntries(
		CONFIG_FILES.map((file) => [
			file,
			ConfigSchemas[file].parse(input[file]),
		]),
	) as WorkspacePlan;
}
