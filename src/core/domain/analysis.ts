/** Analysis tiers. Single source for the tier union. */
export const ANALYSIS_TIERS = ["triage", "analyse"] as const;

/** Analysis verdicts. Single source for the verdict union. */
export const ANALYSIS_VERDICTS = [
	"pass",
	"shortlist",
	"reject",
	"hold",
] as const;

/** Analysis authors. Single source for the author union. */
export const ANALYSIS_AUTHORS = ["agent", "user"] as const;

/** Interaction actions. Single source for the action union. */
export const INTERACTION_ACTIONS = [
	"viewed",
	"favorited",
	"rejected",
	"viewing-requested",
	"visited",
	"shared",
] as const;

/** A recorded judgment on one offer, cheap or deep. */
export interface Analysis {
	id: string;
	offerId: string;
	tier: (typeof ANALYSIS_TIERS)[number];
	verdict: (typeof ANALYSIS_VERDICTS)[number];
	reason: string;
	pros: string[];
	cons: string[];
	priceAssessment?: string;
	redFlags?: string[];
	recommendation?: string;
	confidence?: number;
	author: (typeof ANALYSIS_AUTHORS)[number];
	createdAt: string;
}

/** A recorded user reaction on one offer. */
export interface Interaction {
	id: string;
	offerId: string;
	action: (typeof INTERACTION_ACTIONS)[number];
	reason?: string;
	createdAt: string;
}
