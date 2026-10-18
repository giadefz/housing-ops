import { readInstance, writeInstance } from "./adapters/secondary/instance.js";
import { storeFactory } from "./adapters/secondary/store-factory.js";
import { systemClock } from "./adapters/secondary/system-clock.js";
import { readWorkspaceFiles } from "./adapters/secondary/workspace.js";
import { composeApplication } from "./composition/index.js";
import { irelandPack } from "./countries/ie/pack.js";
import type { ApplicationPort } from "./core/ports/application.port.js";
import { assertInterfaceEnabled } from "./core/services/instance.service.js";

/** Builds the application with the bundled adapters. */
export async function createApplication(
	root: string,
): Promise<ApplicationPort> {
	assertInterfaceEnabled(readInstance(root), "cli");
	return composeApplication(root, {
		storeFactory,
		readWorkspaceFiles: readWorkspaceFiles,
		writeInstance,
		clock: systemClock,
		pack: irelandPack,
		warn: (message) =>
			process.stderr.write(`housing-ops: warning: ${message}\n`),
	});
}
