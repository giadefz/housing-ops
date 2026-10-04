import type { Listing } from "../domain/listing.js";
import type { ProviderTestResult } from "../ports/application.port.js";
import type { ProviderPort } from "../ports/provider.port.js";

export interface ProviderTrial {
	provider: ProviderPort;
	cap: number;
}

const TRIAL_TIMEOUT_MS = 30_000;

/** Runs a provider on a small sample. Fetches at most `cap` listings and stops. */
export async function testProvider(
	trial: ProviderTrial,
): Promise<ProviderTestResult> {
	const context = {
		signal: AbortSignal.timeout(TRIAL_TIMEOUT_MS),
		pace: async () => {},
		log: () => {},
	};
	const sample: Listing[] = [];
	for await (const listing of trial.provider.fetch({}, context)) {
		sample.push(listing);
		if (sample.length >= trial.cap) break;
	}
	return { fetched: sample.length, sample };
}
