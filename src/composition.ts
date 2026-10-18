import yaml from "js-yaml";
import {
	buildFilterStages,
	collectFilters,
	listFilters,
} from "./adapters/secondary/filters/registry.js";
import { profileCoverageWarnings } from "./adapters/secondary/filters/coverage.js";
import { assertInstanceWritable } from "./adapters/secondary/instance.js";
import type { WorkspaceReadRequest } from "./adapters/secondary/workspace.js";
import type { WorkspaceFiles } from "./adapters/secondary/workspace.js";
import {
	buildProviders,
	listProviderSummaries,
} from "./adapters/secondary/providers/registry.js";
import { createEventBusBuilder } from "./adapters/secondary/publishers/event-bus-builder.js";
import { CorruptRecordError } from "./adapters/secondary/storage/sqlite/record.js";
import type { CountryPack } from "./core/domain/country-pack.js";
import { DEFAULT_MEMBER_ID } from "./core/domain/member.js";
import { FilterNotFoundError } from "./core/errors/filter.js";
import { ProfileNotFoundError } from "./core/errors/profile.js";
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
import type { Config } from "./core/schemas/config.js";
import type { Instance } from "./core/schemas/instance.js";
import type { Profile } from "./core/schemas/profile.js";
import { getConfig, setConfig } from "./core/services/config.service.js";
import { buildDigest } from "./core/services/digest.service.js";
import {
	emptyFeed,
	fillFeed,
	getFeedStatus,
} from "./core/services/feed.service.js";
import { checkFilter } from "./core/services/filter.service.js";
import { initWorkspace } from "./core/services/init.service.js";
import { interact } from "./core/services/interaction.service.js";
import { getOffer } from "./core/services/offer.service.js";
import {
	getMemberProfile,
	setMemberProfile,
} from "./core/services/profile.service.js";
import {
	testProvider as runProviderTest,
	type ProviderTrial,
} from "./core/services/provider.service.js";
import { listQueue } from "./core/services/queue.service.js";
import { publishNow } from "./core/services/publish.service.js";
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
	readWorkspaceFiles: (request: WorkspaceReadRequest) => WorkspaceFiles;
	writeInstance: (root: string, instance: Instance, force: boolean) => void;
	clock: ClockPort;
	pack: CountryPack;
	warn: (message: string) => void;
}

/** Wires the given adapters into the application surface inbound adapters drive. */
export async function createApplication(
	root: string,
	dependencies: ApplicationDependencies,
): Promise<ApplicationPort> {
	const {
		storeFactory,
		readWorkspaceFiles,
		writeInstance: writeInstanceFile,
		clock,
		pack,
		warn,
	} = dependencies;
	const snapshot = await readStoreSnapshot(storeFactory, root);
	const workspace = readWorkspaceFiles({
		root,
		store: storeFactory.describe(root),
		expectedSchemaVersion: storeFactory.targetSchemaVersion,
	});
	const { config, profile } = snapshot;
	const pipelineText = config === null ? null : yaml.dump(config.pipeline);
	const providersText = config === null ? null : yaml.dump(config.providers);
	const publishersText =
		config === null ? null : yaml.dump(config.publishers);
	const events = createEventBusBuilder(warn)
		.withPublishers(publishersText)
		.build();
	const filters = await collectFilters(root, workspace.extensionsText);
	warnOnProfileGaps({
		profile,
		pipelineText,
		country: pack.code,
		filters,
		warn,
	});
	return {
		getVersion,
		validateWorkspace: () =>
			validateWorkspace({
				instanceText: workspace.instanceText,
				config,
				profile,
				configError: snapshot.configError,
				profileError: snapshot.profileError,
				extensionsText: workspace.extensionsText,
				currentHashes: workspace.currentHashes,
				store: workspace.store,
				expectedSchemaVersion: workspace.expectedSchemaVersion,
			}),
		init: async (request) => {
			assertInstanceWritable(root, request.force);
			const description = storeFactory.init(root);
			return withStore(storeFactory, root, (store) =>
				initWorkspace({
					input: request.input,
					force: request.force,
					writeInstance: (instance, force) =>
						writeInstanceFile(root, instance, force),
					store,
					database: description.location,
				}),
			);
		},
		getConfig: () =>
			withStore(storeFactory, root, (store) => getConfig({ store })),
		setConfig: (next) =>
			withStore(storeFactory, root, (store) =>
				setConfig({ store, config: next }),
			),
		getOffer: (input) =>
			withStore(storeFactory, root, (store) =>
				getOffer(store, input.memberId, input.offerId),
			),
		listQueue: (input) =>
			withStore(storeFactory, root, (store) =>
				listQueue({
					store,
					memberId: input.memberId,
					input: input.queue,
				}),
			),
		getFeedStatus: (input) =>
			withStore(storeFactory, root, (store) =>
				getFeedStatus({ store, memberId: input.memberId }),
			),
		fillFeed: (input) =>
			withStore(storeFactory, root, (store) =>
				fillFeed({
					store,
					events,
					profile: requireProfile(profile),
					filters: buildFilterStages(
						pipelineText,
						pack.code,
						filters,
					),
					memberId: input.memberId,
				}),
			),
		emptyFeed: (input) =>
			withStore(storeFactory, root, (store) =>
				emptyFeed({ store, memberId: input.memberId }),
			),
		setVerdict: (input) =>
			withStore(storeFactory, root, (store) =>
				setVerdict({
					store,
					clock,
					events,
					memberId: input.memberId,
					offerId: input.offerId,
					input: input.verdict,
				}),
			),
		interact: (input) =>
			withStore(storeFactory, root, (store) =>
				interact({
					store,
					clock,
					memberId: input.memberId,
					offerId: input.offerId,
					input: input.interaction,
				}),
			),
		getProfile: (input) =>
			withStore(storeFactory, root, (store) =>
				getMemberProfile({
					store,
					memberId: input.memberId,
					path: input.path,
				}),
			),
		setProfile: (input) =>
			withStore(storeFactory, root, (store) =>
				setMemberProfile({
					store,
					memberId: input.memberId,
					path: input.path,
					value: input.value,
				}),
			),
		getDigest: (input) =>
			withStore(storeFactory, root, (store) =>
				buildDigest({
					store,
					clock,
					profile: requireProfile(profile),
					memberId: input.memberId,
				}),
			),
		publishNow: (input) =>
			withStore(storeFactory, root, (store) =>
				publishNow({
					store,
					events,
					memberId: input.memberId,
					input: input.publish,
				}),
			),
		listProviders: () => listProviderSummaries(providersText),
		listFilters: () => listFilters(pipelineText, pack.code, filters),
		checkFilter: (id) =>
			withStore(storeFactory, root, (store) =>
				checkFilterPort({
					filters,
					profile: requireProfile(profile),
					id,
					store,
				}),
			),
		testProvider: (id) => runProviderTest(providerTrial(providersText, id)),
		scan: (input) =>
			withStore(storeFactory, root, (store) =>
				scan(
					scanDependencies(
						{
							providersText,
							events,
							pipelineText,
							profile: requireProfile(profile),
							pack,
							clock,
							filters,
							memberId: input.memberId,
						},
						input.providerId,
						store,
					),
				),
			),
	};
}

interface StoreSnapshot {
	config: Config | null;
	profile: Profile | null;
	configError?: string;
	profileError?: string;
}

/** Reads the shared config and the admin profile from the store. */
async function readStoreSnapshot(
	storeFactory: StoreFactory,
	root: string,
): Promise<StoreSnapshot> {
	const description = storeFactory.describe(root);
	if (description.schemaVersion === null)
		return { config: null, profile: null };
	const handle = storeFactory.open(root);
	try {
		return {
			...(await readSnapshotConfig(handle.store)),
			...(await readSnapshotProfile(handle.store)),
		};
	} finally {
		handle.close();
	}
}

async function readSnapshotConfig(
	store: OfferStorePort,
): Promise<Pick<StoreSnapshot, "config" | "configError">> {
	try {
		return { config: await store.readConfig() };
	} catch (error) {
		if (error instanceof CorruptRecordError)
			return { config: null, configError: error.message };
		throw error;
	}
}

async function readSnapshotProfile(
	store: OfferStorePort,
): Promise<Pick<StoreSnapshot, "profile" | "profileError">> {
	try {
		return {
			profile: await store.readMemberProfile(DEFAULT_MEMBER_ID),
		};
	} catch (error) {
		if (error instanceof CorruptRecordError)
			return { profile: null, profileError: error.message };
		throw error;
	}
}

/** Returns the admin profile, or throws when it is not initialized. */
function requireProfile(profile: Profile | null): Profile {
	if (profile === null) throw new ProfileNotFoundError(DEFAULT_MEMBER_ID);
	return profile;
}

interface ProfileGapInput {
	profile: Profile | null;
	pipelineText: string | null;
	country: string;
	filters: Map<string, FilterPort>;
	warn: (message: string) => void;
}

/** Reports profile fields and enabled filters that do not line up, at boot. */
function warnOnProfileGaps(input: ProfileGapInput): void {
	if (input.profile === null) return;
	const stages = buildFilterStages(
		input.pipelineText,
		input.country,
		input.filters,
	);
	const warnings = profileCoverageWarnings(stages, input.profile);
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
	profile: Profile;
	id: string;
	store: OfferStorePort;
}

async function checkFilterPort(
	request: FilterCheckRequest,
): Promise<FilterCheckResult> {
	const { filters, profile, id, store } = request;
	const filter = filters.get(id);
	if (filter === undefined) throw new FilterNotFoundError(id);
	return checkFilter({
		filter,
		profile,
		samples: await store.listStoredOffers(CHECK_SAMPLE_LIMIT),
		exampleLimit: CHECK_EXAMPLE_LIMIT,
	});
}

/** The values scan needs that do not depend on which provider is being scanned. */
interface ScanInputs {
	providersText: string | null;
	events: EventBus;
	pipelineText: string | null;
	profile: Profile;
	pack: CountryPack;
	clock: ClockPort;
	filters: Map<string, FilterPort>;
	memberId: string;
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
		profile,
		pack,
		clock,
		filters,
		memberId,
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
		profile,
		filters: buildFilterStages(pipelineText, pack.code, filters),
		memberId,
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
