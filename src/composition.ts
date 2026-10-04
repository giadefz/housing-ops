import {
	buildProviders,
	listProviderSummaries,
} from "./adapters/secondary/providers/registry.js";
import { ProviderNotFoundError } from "./core/errors/provider.js";
import type { ApplicationPort } from "./core/ports/application.port.js";
import type { OfferStorePort, StoreFactory } from "./core/ports/store.port.js";
import { getOffer } from "./core/services/offer.service.js";
import { testProvider as runProviderTest } from "./core/services/provider.service.js";
import {
	validateWorkspace,
	type WorkspaceInput,
} from "./core/services/validate.service.js";
import { getVersion } from "./core/version.js";

const PROVIDER_TEST_CAP = 5;

/** The concrete adapters the application is wired with. */
export interface ApplicationDependencies {
	storeFactory: StoreFactory;
	readWorkspace: (root: string) => WorkspaceInput;
}

/** Wires the given adapters into the application surface inbound adapters drive. */
export function createApplication(
	root: string,
	dependencies: ApplicationDependencies,
): ApplicationPort {
	const { storeFactory, readWorkspace } = dependencies;
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
		listProviders: () =>
			listProviderSummaries(
				readWorkspace(root).configTexts["providers.yml"],
			),
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
