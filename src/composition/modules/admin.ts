import type { AdminPort } from "../../core/ports/application.port.js";
import { validateWorkspace } from "../../core/services/validate.service.js";
import { getVersion } from "../../core/version.js";
import type { Boot } from "../types.js";
import { toWorkspaceInput } from "../validation.js";

/** Version and workspace validation. */
export function adminModule(boot: Boot): AdminPort {
	return {
		getVersion,
		validateWorkspace: () => validateWorkspace(toWorkspaceInput(boot)),
	};
}
