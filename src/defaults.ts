import { storeFactory } from "./adapters/secondary/store-factory.js";
import { systemClock } from "./adapters/secondary/system-clock.js";
import { readWorkspace, writeProfile } from "./adapters/secondary/workspace.js";
import { createApplication } from "./composition.js";
import { irelandPack } from "./countries/ie/pack.js";
import type { ApplicationPort } from "./core/ports/application.port.js";

/** Builds the application with the default (bundled) adapters. */
export function createDefaultApplication(
	root: string,
): Promise<ApplicationPort> {
	return createApplication(root, {
		storeFactory,
		readWorkspace,
		writeProfile,
		clock: systemClock,
		pack: irelandPack,
		warn: (message) =>
			process.stderr.write(`housing-ops: warning: ${message}\n`),
	});
}
