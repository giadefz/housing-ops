import type { Dwelling } from "../domain/dwelling.js";
import type { Offer } from "../domain/offer.js";
import type { FilterCheckResult } from "../ports/application.port.js";
import type { FilterPort } from "../ports/filter.port.js";
import type { Profile } from "../schemas/profile.js";

export interface FilterCheckInput {
	filter: FilterPort;
	profile: Profile;
	samples: Array<{ offer: Offer; dwelling: Dwelling }>;
	exampleLimit: number;
}

/** Runs a filter over stored offers and reports the verdict distribution. */
export function checkFilter(input: FilterCheckInput): FilterCheckResult {
	const results = input.samples.map((sample) =>
		decide(input.filter, input.profile, sample),
	);
	return tally(results, input.exampleLimit);
}

interface Example {
	offerId: string;
	outcome: "pass" | "fail" | "skip";
	reason: string;
}

function decide(
	filter: FilterPort,
	profile: Profile,
	sample: { offer: Offer; dwelling: Dwelling },
): Example {
	const decision = filter.evaluate({
		offer: sample.offer,
		dwelling: sample.dwelling,
		profile,
		comparables: [],
	});
	return {
		offerId: sample.offer.id,
		outcome: decision.outcome,
		reason: "reason" in decision ? decision.reason : "",
	};
}

function tally(results: Example[], exampleLimit: number): FilterCheckResult {
	return {
		evaluated: results.length,
		pass: countOutcome(results, "pass"),
		fail: countOutcome(results, "fail"),
		skip: countOutcome(results, "skip"),
		examples: results
			.filter((result) => result.outcome !== "pass")
			.slice(0, exampleLimit),
	};
}

function countOutcome(results: Example[], outcome: Example["outcome"]): number {
	return results.filter((result) => result.outcome === outcome).length;
}
