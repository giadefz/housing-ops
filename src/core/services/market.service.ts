import {
	recordMarketEvent,
	type MarketOutcome,
	type Offer,
} from "../domain/offer.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { EventBus } from "../ports/event-bus.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import { requireOffer } from "./offer.service.js";

/** One request to record a proven market outcome. */
export interface MarketOutcomeRequest {
	store: OfferStorePort;
	clock: ClockPort;
	events: EventBus;
	id: string;
	outcome: MarketOutcome;
	runId?: string;
}

/** Closes an offer through the domain, appends the event, and emits the milestone. */
export async function markOutcome(
	request: MarketOutcomeRequest,
): Promise<Offer> {
	const { store, clock, events, id, outcome, runId } = request;
	const offer = await requireOffer(store, id);
	const closed = recordMarketEvent(offer, outcome);
	await store.recordMarketOutcome(closed, {
		outcome,
		observedAt: clock.now(),
		runId,
	});
	await events.emit("offer.closed", { offer: closed });
	return closed;
}
