#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runCli } from "./adapters/primary/cli/run.js";
import { storeFactory } from "./adapters/secondary/store-factory.js";
import { readWorkspace, resolveRoot } from "./adapters/secondary/workspace.js";
import type { ApplicationPort } from "./core/ports/application.port.js";
import type { OfferStorePort } from "./core/ports/store.port.js";
import { getOffer } from "./core/services/offer.service.js";
import { validateWorkspace } from "./core/services/validate.service.js";
import { getVersion } from "./core/version.js";

/** Builds the application surface inbound adapters drive. The only place adapters are wired together. */
export function createApplication(root: string): ApplicationPort {
	const withStore = async <T>(
		use: (store: OfferStorePort) => Promise<T>,
	): Promise<T> => {
		const handle = storeFactory.open(root);
		try {
			return await use(handle.store);
		} finally {
			handle.close();
		}
	};
	return {
		getVersion,
		validateWorkspace: () => validateWorkspace(readWorkspace(root)),
		getOffer: (id) => withStore((store) => getOffer(store, id)),
	};
}

async function main(): Promise<void> {
	await runCli(createApplication(resolveRoot()), process.argv);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
