import {
	buildFilterStages,
	collectFilters,
	listFilters,
} from "./adapters/secondary/filters/registry.js";
import { profileCoverageWarnings } from "./adapters/secondary/filters/coverage.js";
import { parseProfile } from "./adapters/secondary/profile.js";
import {
	buildProviders,
	listProviderSummaries,
} from "./adapters/secondary/providers/registry.js";
import {
	buildPublishers,
	registerPublishers,
} from "./adapters/secondary/publishers/registry.js";
import { createEventBus } from "./adapters/secondary/event-bus.js";
import type { CountryPack } from "./core/domain/country-pack.js";
import { FilterNotFoundError } from "./core/errors/filter.js";
import { ProviderNotFoundError } from "./core/errors/provider.js";
import type {
	ApplicationPort,
	FilterCheckResult,
	ScanResult,
} from "./core/ports/application.port.js";
import type { ClockPort } from "./core/ports/clock.port.js";
import type { EventBus } from "./core/ports/event-bus.port.js";
import type { FilterPort } from "./core/ports/filter.port.js";
import type { ProviderPort } from "./core/ports/provider.port.js";
import type { OfferStorePort, StoreFactory } from "./core/ports/store.port.js";
import type { Profile } from "./core/schemas/profile.js";
import { buildDigest } from "./core/services/digest.service.js";
import { checkFilter } from "./core/services/filter.service.js";
import { interact } from "./core/services/interaction.service.js";
import { getOffer } from "./core/services/offer.service.js";
import {
	readProfileValue,
	setProfileValue,
} from "./core/services/profile.service.js";
import {
	testProvider as runProviderTest,
	type ProviderTrial,
} from "./core/services/provider.service.js";
import { listQueue } from "./core/services/queue.service.js";
import { scan, type ScanDependencies } from "./core/services/scan.service.js";
import { setVerdict } from "./core/services/verdict.service.js";
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
	writeProfile: (root: string, profile: Profile) => void;
	clock: ClockPort;
	pack: CountryPack;
	warn: (message: string) => void;
}

/** Wires the given adapters into the application surface inbound adapters drive. */
export async function createApplication(
	root: string,
	dependencies: ApplicationDependencies,
): Promise<ApplicationPort> {
	const { storeFactory, readWorkspace, writeProfile, clock, pack, warn } =
		dependencies;
	const workspace = readWorkspace(root);
	const providersText = workspace.configTexts["providers.yml"];
	const pipelineText = workspace.configTexts["pipeline.yml"];
	const profileText = workspace.configTexts["profile.yml"];
	const publishersText = workspace.configTexts["publishers.yml"];
	const events = createEventBus(warn);
	registerPublishers(events, buildPublishers(publishersText));
	const filters = await collectFilters(
		root,
		workspace.configTexts["extensions.yml"],
	);
	warnOnProfileGaps({
		profileText,
		pipelineText,
		country: pack.code,
		filters,
		warn,
	});
	return {
		getVersion,
		validateWorkspace: () => validateWorkspace(workspace),
		getOffer: (id) =>
			withStore(storeFactory, root, (store) => getOffer(store, id)),
		listQueue: (input) =>
			withStore(storeFactory, root, (store) =>
				listQueue({ store, input }),
			),
		setVerdict: (id, input) =>
			withStore(storeFactory, root, (store) =>
				setVerdict({ store, clock, events, id, input }),
			),
		interact: (id, input) =>
			withStore(storeFactory, root, (store) =>
				interact({ store, clock, id, input }),
			),
		getProfile: (input) => ({
			path: input.path ?? null,
			value: readProfileValue(parseProfile(profileText), input.path),
		}),
		setProfile: (input) => {
			const updated = setProfileValue(
				parseProfile(profileText),
				input.path,
				input.value,
			);
			writeProfile(root, updated);
			return {
				path: input.path,
				value: readProfileValue(updated, input.path),
			};
		},
		getDigest: () =>
			withStore(storeFactory, root, (store) =>
				buildDigest({
					store,
					clock,
					profile: parseProfile(profileText),
				}),
			),
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
							events,
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

interface ProfileGapInput {
	profileText: string | null;
	pipelineText: string | null;
	country: string;
	filters: Map<string, FilterPort>;
	warn: (message: string) => void;
}

/** Reports profile fields and enabled filters that do not line up, at boot. */
function warnOnProfileGaps(input: ProfileGapInput): void {
	const stages = buildFilterStages(
		input.pipelineText,
		input.country,
		input.filters,
	);
	const warnings = profileCoverageWarnings(
		stages,
		parseProfile(input.profileText),
	);
	for (const warning of warnings) input.warn(warning);
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
	events: EventBus;
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
	const {
		providersText,
		events,
		pipelineText,
		profileText,
		pack,
		clock,
		filters,
	} = inputs;
	const providers = selectProviders(
		buildProviders(providersText),
		providerId,
	);
	if (providerId !== undefined && providers.length === 0) {
		throw new ProviderNotFoundError(providerId);
	}
	return {
		providers,
		events,
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
