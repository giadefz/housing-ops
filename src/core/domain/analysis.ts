/** Analysis tiers. Single source for the tier union. */
export const ANALYSIS_TIERS = ["triage", "analyse"] as const;

/** Analysis verdicts. Single source for the verdict union. */
export const ANALYSIS_VERDICTS = [
	"screened",
	"shortlist",
	"reject",
	"hold",
] as const;

/** Triage verdicts: cheap screening. `screened` is triage-only. */
export const TRIAGE_VERDICTS = ["screened", "reject", "hold"] as const;

/** Analyse verdicts: deep judgment. `shortlist` is analysis-only. */
export const ANALYSE_VERDICTS = ["shortlist", "reject", "hold"] as const;

/** The tier a judgment belongs to. */
export type AnalysisTier = (typeof ANALYSIS_TIERS)[number];

/** The answer a judgment records. */
export type AnalysisVerdict = (typeof ANALYSIS_VERDICTS)[number];

/** True when a value is a known tier. */
export function isAnalysisTier(value: string): value is AnalysisTier {
	return (ANALYSIS_TIERS as readonly string[]).includes(value);
}

/** True when a value is a known verdict. */
export function isAnalysisVerdict(value: string): value is AnalysisVerdict {
	return (ANALYSIS_VERDICTS as readonly string[]).includes(value);
}

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
	memberId: string;
	offerId: string;
	tier: AnalysisTier;
	verdict: AnalysisVerdict;
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
	memberId: string;
	offerId: string;
	action: (typeof INTERACTION_ACTIONS)[number];
	reason?: string;
	createdAt: string;
}
