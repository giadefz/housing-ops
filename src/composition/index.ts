import type { ApplicationPort } from "../core/ports/application.port.js";
import { bootApplication } from "./boot.js";
import { adminModule } from "./modules/admin.js";
import { catalogModule } from "./modules/catalog.js";
import { configModule } from "./modules/config.js";
import { judgmentsModule } from "./modules/judgments.js";
import { offersModule } from "./modules/offers.js";
import { scanModule } from "./modules/scan.js";
import type { ApplicationDependencies } from "./types.js";
import { createWiring } from "./wiring.js";

export type { ApplicationDependencies } from "./types.js";

/** Wires the given adapters into the application surface inbound adapters drive. */
export async function createApplication(
	root: string,
	dependencies: ApplicationDependencies,
): Promise<ApplicationPort> {
	const boot = await bootApplication(root, dependencies);
	const wiring = await createWiring(root, dependencies, boot);
	return {
		...adminModule(boot),
		...configModule(wiring),
		...offersModule(wiring),
		...judgmentsModule(wiring),
		...catalogModule(wiring),
		...scanModule(wiring),
	};
}
