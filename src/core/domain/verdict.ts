/** One filter's judgment on one offer. Immutable. */
export interface Verdict {
	filterId: string;
	outcome: "pass" | "fail" | "skip";
	reason: string;
}
