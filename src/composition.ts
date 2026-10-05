import {
	buildFilterStages,
	listFilters,
} from "./adapters/secondary/filters/registry.js";
import { parseProfile } from "./adapters/secondary/profile.js";
import {
	buildProviders,
	listProviderSummaries,
} from "./adapters/secondary/providers/registry.js";
import type { CountryPack } from "./core/domain/country-pack.js";
import { ProviderNotFoundError } from "./core/errors/provider.js";
import type {
	ApplicationPort,
} from "./core/ports/application.port.js";
import type { ClockPort } from "./core/ports/clock.port.js";
import type { ProviderPort } from "./core/ports/provider.port.js";
import type { OfferStorePort, StoreFactory } from "./core/ports/store.port.js";
import { getOffer } from "./core/services/offer.service.js";
import {
	testProvider as runProviderTest,
	type ProviderTrial,
} from "./core/services/provider.service.js";
import { scan, type ScanDependencies } from "./core/services/scan.service.js";
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
	clock: ClockPort;
	pack: CountryPack;
}

/** Wires the given adapters into the application surface inbound adapters drive. */
export function createApplication(
	root: string,
	dependencies: ApplicationDependencies,
): ApplicationPort {
	const { storeFactory, readWorkspace, clock, pack } = dependencies;
	const workspace = readWorkspace(root);
	const providersText = workspace.configTexts["providers.yml"];
	const pipelineText = workspace.configTexts["pipeline.yml"];
	const profileText = workspace.configTexts["profile.yml"];
	return {
		getVersion,
		validateWorkspace: () => validateWorkspace(workspace),
		getOffer: (id) =>
			withStore(storeFactory, root, (store) => getOffer(store, id)),
		listProviders: () => listProviderSummaries(providersText),
		listFilters: () => listFilters(pipelineText, pack.code),
		testProvider: (id) => runProviderTest(providerTrial(providersText, id)),
		scan: (providerId) =>
			withStore(storeFactory, root, (store) =>
				scan(
					scanDependencies(
						{
							providersText,
							pipelineText,
							profileText,
							pack,
							clock,
						},
						providerId,
						store,
					),
				),
			),
	};
}

async function withStore<T>(
	storeFactory: StoreFactory,
	root: string,
	use: (store: OfferStorePort) => Promise<T>,
): Promise<T> {
	const handle = storeFactory.open(root);
	try {
		return await use(handle.store);
	} finally {
		handle.close();
	}
}

function providerTrial(
	providersText: string | null,
	id: string,
): ProviderTrial {
	const provider = buildProviders(providersText).get(id);
	if (provider === undefined) throw new ProviderNotFoundError(id);
	return { provider, cap: PROVIDER_TEST_CAP };
}

/** The values scan needs that do not depend on which provider is being scanned. */
interface ScanInputs {
	providersText: string | null;
	pipelineText: string | null;
	profileText: string | null;
	pack: CountryPack;
	clock: ClockPort;
}

function scanDependencies(
	inputs: ScanInputs,
	providerId: string | undefined,
	store: OfferStorePort,
): ScanDependencies {
	const { providersText, pipelineText, profileText, pack, clock } = inputs;
	const providers = selectProviders(
		buildProviders(providersText),
		providerId,
	);
	if (providerId !== undefined && providers.length === 0) {
		throw new ProviderNotFoundError(providerId);
	}
	return {
		providers,
		store,
		pack,
		clock,
		profile: parseProfile(profileText),
		filters: buildFilterStages(pipelineText, pack.code),
	};
}

function selectProviders(
	providers: Map<string, ProviderPort>,
	providerId: string | undefined,
): ProviderPort[] {
	return [...providers.values()].filter(
		(provider) => providerId === undefined || provider.id === providerId,
	);
}
