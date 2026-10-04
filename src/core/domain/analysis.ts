/** A recorded judgment on one offer, cheap or deep. */
export interface Analysis {
	id: string;
	offerId: string;
	tier: "triage" | "analyse";
	verdict: "pass" | "shortlist" | "reject" | "hold";
	reason: string;
	pros: string[];
	cons: string[];
	priceAssessment?: string;
	redFlags?: string[];
	recommendation?: string;
	confidence?: number;
	author: "agent" | "user";
	createdAt: string;
}

/** A recorded user reaction on one offer. */
export interface Interaction {
	id: string;
	offerId: string;
	action:
		| "viewed"
		| "favorited"
		| "rejected"
		| "viewing-requested"
		| "visited"
		| "shared";
	reason?: string;
	createdAt: string;
}
