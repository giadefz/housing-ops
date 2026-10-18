import type { WorkspaceInput } from "../core/services/validate.service.js";
import type { Boot } from "./types.js";

/** Builds the validation input from the boot snapshot. */
export function toWorkspaceInput(boot: Boot): WorkspaceInput {
	return {
		instanceText: boot.workspace.instanceText,
		config: boot.config,
		profile: boot.profile,
		configError: boot.configError,
		profileError: boot.profileError,
		members: boot.members,
		extensionsText: boot.workspace.extensionsText,
		currentHashes: boot.workspace.currentHashes,
		store: boot.workspace.store,
		expectedSchemaVersion: boot.workspace.expectedSchemaVersion,
	};
}
