import { ListingSchema, type Listing } from "../domain/listing.js";
import { ProviderError } from "../errors/provider.js";
import type { ProviderTestResult } from "../ports/application.port.js";
import type { ProviderPort } from "../ports/provider.port.js";

export interface ProviderTrial {
	provider: ProviderPort;
	cap: number;
}

const TRIAL_TIMEOUT_MS = 30_000;

/** Runs a provider on a small sample. Validates every record against the interchange. */
export async function testProvider(
	trial: ProviderTrial,
): Promise<ProviderTestResult> {
	const context = {
		signal: AbortSignal.timeout(TRIAL_TIMEOUT_MS),
		pace: async () => {},
		log: () => {},
	};
	const sample: Listing[] = [];
	for await (const record of trial.provider.fetch({}, context)) {
		sample.push(validate(record, trial.provider.id, sample.length));
		if (sample.length >= trial.cap) break;
	}
	return { fetched: sample.length, sample };
}

function validate(record: unknown, provider: string, index: number): Listing {
	const parsed = ListingSchema.safeParse(record);
	if (!parsed.success) {
		throw new ProviderError(
			provider,
			`record ${index} failed interchange: ${parsed.error.message}`,
			parsed.error,
		);
	}
	return parsed.data;
}
