import type { Analysis, Interaction } from "../domain/analysis.js";
import type { Dwelling } from "../domain/dwelling.js";
import type { Offer, OfferStatus } from "../domain/offer.js";
import type { Verdict } from "../domain/verdict.js";

/** One queue row. Compact by design: full payloads come from findOffer. */
export interface OfferSummary {
	id: string;
	provider: string;
	price: { amount: number; currency: string };
	addressShort: string;
	bedrooms?: number;
	sizeM2?: number;
	layout: string;
	status: OfferStatus;
	fetchedAt: string;
}

/** One pipeline run's counters. */
export interface RunStats {
	fetched: number;
	normalized: number;
	passed: number;
	failed: number;
	skipped: number;
	stored: number;
}

/** Persists and queries offers. Implemented by storage adapters. */
export interface OfferStorePort {
	saveDwelling(dwelling: Dwelling): Promise<void>;
	findDwellingByAddressKey(addressKey: string): Promise<Dwelling | null>;
	saveOffer(offer: Offer): Promise<void>;
	findOffer(id: string): Promise<Offer | null>;
	findOfferByListing(
		provider: string,
		listingId: string,
	): Promise<Offer | null>;
	recordVerdict(
		offerId: string,
		runId: string,
		verdict: Verdict,
	): Promise<void>;
	recordAnalysis(analysis: Analysis): Promise<void>;
	recordInteraction(interaction: Interaction): Promise<void>;
	listQueue(status: OfferStatus, limit: number): Promise<OfferSummary[]>;
	startRun(provider: string): Promise<string>;
	finishRun(runId: string, stats: RunStats): Promise<void>;
}
