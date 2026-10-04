import type { Analysis, Interaction } from "../domain/analysis.js";
import type { Dwelling } from "../domain/dwelling.js";
import type { MarketOutcome, Offer, OfferStatus } from "../domain/offer.js";
import type { Verdict } from "../domain/verdict.js";

/** One queue entry. Compact by design: full payloads come from findOffer. */
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

/** A listing that failed normalization, kept for inspection. */
export interface DeadLetterEntry {
	runId: string;
	provider: string;
	payload: unknown;
	error: string;
	receivedAt: string;
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
	listVerdicts(offerId: string): Promise<Verdict[]>;
	recordAnalysis(analysis: Analysis): Promise<void>;
	recordInteraction(interaction: Interaction): Promise<void>;
	listQueue(status: OfferStatus, limit: number): Promise<OfferSummary[]>;
	startRun(provider: string): Promise<string>;
	finishRun(runId: string, stats: RunStats): Promise<void>;
	recordDeadLetter(entry: DeadLetterEntry): Promise<void>;
	markMarketOutcome(
		offerId: string,
		outcome: MarketOutcome,
		observedAt: string,
	): Promise<void>;
}

/** An open store plus its lifecycle. What composition holds and closes. */
export interface StoreHandle {
	store: OfferStorePort;
	close(): void;
}

/** Opens a workspace's store. Implemented by each datastore adapter. */
export interface StoreFactory {
	open(workspaceRoot: string): StoreHandle;
}
