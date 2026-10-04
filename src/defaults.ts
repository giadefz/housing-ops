import { storeFactory } from "./adapters/secondary/store-factory.js";
import { readWorkspace } from "./adapters/secondary/workspace.js";
import { createApplication } from "./composition.js";
import type { ApplicationPort } from "./core/ports/application.port.js";

/** Builds the application with the default (bundled) adapters. */
export function createDefaultApplication(root: string): ApplicationPort {
	return createApplication(root, { storeFactory, readWorkspace });
}
