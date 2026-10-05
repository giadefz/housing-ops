import {
	buildFilterStages,
	collectFilters,
	listFilters,
} from "./adapters/secondary/filters/registry.js";
import { parseProfile } from "./adapters/secondary/profile.js";
import {
	buildProviders,
	listProviderSummaries,
} from "./adapters/secondary/providers/registry.js";
import type { CountryPack } from "./core/domain/country-pack.js";
import { FilterNotFoundError } from "./core/errors/filter.js";
import { ProviderNotFoundError } from "./core/errors/provider.js";
import type {
	ApplicationPort,
	FilterCheckResult,
	ScanResult,
} from "./core/ports/application.port.js";
import type { ClockPort } from "./core/ports/clock.port.js";
import type { FilterPort } from "./core/ports/filter.port.js";
import type { ProviderPort } from "./core/ports/provider.port.js";
import type { OfferStorePort, StoreFactory } from "./core/ports/store.port.js";
import { checkFilter } from "./core/services/filter.service.js";
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
const CHECK_SAMPLE_LIMIT = 50;
const CHECK_EXAMPLE_LIMIT = 5;

/** The concrete adapters the application is wired with. */
export interface ApplicationDependencies {
	storeFactory: StoreFactory;
	readWorkspace: (root: string) => WorkspaceInput;
	clock: ClockPort;
	pack: CountryPack;
}

/** Wires the given adapters into the application surface inbound adapters drive. */
export async function createApplication(
	root: string,
	dependencies: ApplicationDependencies,
): Promise<ApplicationPort> {
	const { storeFactory, readWorkspace, clock, pack } = dependencies;
	const workspace = readWorkspace(root);
	const providersText = workspace.configTexts["providers.yml"];
	const pipelineText = workspace.configTexts["pipeline.yml"];
	const profileText = workspace.configTexts["profile.yml"];
	const filters = await collectFilters(
		root,
		workspace.configTexts["extensions.yml"],
	);
	return {
		getVersion,
		validateWorkspace: () => validateWorkspace(workspace),
		getOffer: (id) =>
			withStore(storeFactory, root, (store) => getOffer(store, id)),
		listProviders: () => listProviderSummaries(providersText),
		listFilters: () => listFilters(pipelineText, pack.code, filters),
		checkFilter: (id) =>
			withStore(storeFactory, root, (store) =>
				checkFilterPort({ filters, profileText, id, store }),
			),
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
							filters,
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

interface FilterCheckRequest {
	filters: Map<string, FilterPort>;
	profileText: string | null;
	id: string;
	store: OfferStorePort;
}

async function checkFilterPort(
	request: FilterCheckRequest,
): Promise<FilterCheckResult> {
	const { filters, profileText, id, store } = request;
	const filter = filters.get(id);
	if (filter === undefined) throw new FilterNotFoundError(id);
	return checkFilter({
		filter,
		profile: parseProfile(profileText),
		samples: await store.listStoredOffers(CHECK_SAMPLE_LIMIT),
		exampleLimit: CHECK_EXAMPLE_LIMIT,
	});
}

/** The values scan needs that do not depend on which provider is being scanned. */
interface ScanInputs {
	providersText: string | null;
	pipelineText: string | null;
	profileText: string | null;
	pack: CountryPack;
	clock: ClockPort;
	filters: Map<string, FilterPort>;
}

function scanDependencies(
	inputs: ScanInputs,
	providerId: string | undefined,
	store: OfferStorePort,
): ScanDependencies {
	const { providersText, pipelineText, profileText, pack, clock, filters } =
		inputs;
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
		filters: buildFilterStages(pipelineText, pack.code, filters),
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
