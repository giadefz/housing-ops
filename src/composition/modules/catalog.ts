import { listFilters } from "../../adapters/secondary/filters/registry.js";
import {
	buildProviders,
	listProviderSummaries,
} from "../../adapters/secondary/providers/registry.js";
import { DEFAULT_MEMBER_ID } from "../../core/domain/member.js";
import { FilterNotFoundError } from "../../core/errors/filter.js";
import { ProviderNotFoundError } from "../../core/errors/provider.js";
import type {
	CatalogPort,
	FilterCheckResult,
} from "../../core/ports/application.port.js";
import type { FilterPort } from "../../core/ports/filter.port.js";
import type { OfferStorePort } from "../../core/ports/store.port.js";
import type { Profile } from "../../core/schemas/profile.js";
import { checkFilter } from "../../core/services/filter.service.js";
import {
	testProvider as runProviderTest,
	type ProviderTrial,
} from "../../core/services/provider.service.js";
import { memberProfile, withStore } from "../store.js";
import type { Wiring } from "../types.js";

const PROVIDER_TEST_CAP = 5;
const CHECK_SAMPLE_LIMIT = 50;
const CHECK_EXAMPLE_LIMIT = 5;

/** Provider and filter catalogue. */
export function catalogModule(wiring: Wiring): CatalogPort {
	const { root, storeFactory, pack, filters, providersText, pipelineText } =
		wiring;
	return {
		listProviders: () => listProviderSummaries(providersText),
		listFilters: () => listFilters(pipelineText, pack.code, filters),
		checkFilter: (id) =>
			withStore(storeFactory, root, async (store) =>
				checkFilterPort({
					filters,
					profile: await memberProfile(store, DEFAULT_MEMBER_ID),
					id,
					store,
				}),
			),
		testProvider: (id) => runProviderTest(providerTrial(providersText, id)),
	};
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
