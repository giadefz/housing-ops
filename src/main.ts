#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runCli } from "./adapters/primary/cli/run.js";
import { buildProviders } from "./adapters/secondary/providers/registry.js";
import { storeFactory } from "./adapters/secondary/store-factory.js";
import { readWorkspace, resolveRoot } from "./adapters/secondary/workspace.js";
import { ProviderNotFoundError } from "./core/errors/provider.js";
import type { ApplicationPort } from "./core/ports/application.port.js";
import type { OfferStorePort } from "./core/ports/store.port.js";
import { getOffer } from "./core/services/offer.service.js";
import { testProvider as runProviderTest } from "./core/services/provider.service.js";
import { validateWorkspace } from "./core/services/validate.service.js";
import { getVersion } from "./core/version.js";

const PROVIDER_TEST_CAP = 5;

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
		testProvider: async (id) => {
			const providers = buildProviders(
				readWorkspace(root).configTexts["providers.yml"],
			);
			const provider = providers.get(id);
			if (provider === undefined) throw new ProviderNotFoundError(id);
			return runProviderTest({ provider, cap: PROVIDER_TEST_CAP });
		},
	};
}

async function main(): Promise<void> {
	await runCli(createApplication(resolveRoot()), process.argv);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
