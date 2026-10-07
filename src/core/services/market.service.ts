import {
	recordMarketEvent,
	type MarketOutcome,
	type Offer,
} from "../domain/offer.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import { requireOffer } from "./offer.service.js";

/** One request to record a proven market outcome. */
export interface MarketOutcomeRequest {
	store: OfferStorePort;
	clock: ClockPort;
	id: string;
	outcome: MarketOutcome;
	runId?: string;
}

/** Closes an offer through the domain and appends the event in one store transaction. */
export async function markOutcome(
	request: MarketOutcomeRequest,
): Promise<Offer> {
	const { store, clock, id, outcome, runId } = request;
	const offer = await requireOffer(store, id);
	const closed = recordMarketEvent(offer, outcome);
	await store.recordMarketOutcome(closed, {
		outcome,
		observedAt: clock.now(),
		runId,
	});
	return closed;
}
