/** All verdict outcomes. Single source for the outcome union. */
export const VERDICT_OUTCOMES = ["pass", "fail", "skip"] as const;

/** One filter's judgment on one offer. Immutable. */
export interface Verdict {
	filterId: string;
	outcome: (typeof VERDICT_OUTCOMES)[number];
	reason: string;
}
