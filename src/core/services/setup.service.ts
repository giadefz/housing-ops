import {
	CONFIG_FILES,
	ConfigSchemas,
	type ConfigFile,
	type SetupInput,
} from "../schemas/index.js";

/** The five config files `setup` writes, each document validated against its schema. */
export type WorkspacePlan = Record<ConfigFile, unknown>;

/** Validates a setup request into a workspace plan. Pure. */
export function planWorkspace(input: SetupInput): WorkspacePlan {
	return Object.fromEntries(
		CONFIG_FILES.map((file) => [
			file,
			ConfigSchemas[file].parse(input[file]),
		]),
	) as WorkspacePlan;
}
