import { buildFilterStages } from "../adapters/secondary/filters/registry.js";
import { buildProviders } from "../adapters/secondary/providers/registry.js";
import type { FeedMember } from "../core/domain/feed.js";
import { DEFAULT_MEMBER_ID } from "../core/domain/member.js";
import { ProviderNotFoundError } from "../core/errors/provider.js";
import type { ScanResult } from "../core/ports/application.port.js";
import type { ProviderPort } from "../core/ports/provider.port.js";
import type { OfferStorePort } from "../core/ports/store.port.js";
import type { Profile } from "../core/schemas/profile.js";
import { scan, type ScanDependencies } from "../core/services/scan.service.js";
import { feedMembers, memberProfile } from "./store.js";
import type { ScanContext } from "./types.js";

interface FeedProfiles {
	poolProfile: Profile;
	members: FeedMember[];
}

type ScanInputs = ScanContext & FeedProfiles;

interface ScanRequest {
	store: OfferStorePort;
	context: ScanContext;
	providerId?: string;
}

/** Loads the profiles, then runs the pool and feed phases. */
export async function runScan(request: ScanRequest): Promise<ScanResult> {
	const profiles = await loadFeedProfiles(request.store);
	return scan(
		scanDependencies(
			{ ...request.context, ...profiles },
			request.providerId,
			request.store,
		),
	);
}

async function loadFeedProfiles(store: OfferStorePort): Promise<FeedProfiles> {
	return {
		poolProfile: await memberProfile(store, DEFAULT_MEMBER_ID),
		members: await feedMembers(store),
	};
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
		poolProfile,
		members,
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
		poolProfile,
		filters: buildFilterStages(pipelineText, pack.code, filters),
		members,
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
