import {
	isMarketClosed,
	recordMarketEvent,
	type Decision,
	type MarketOutcome,
} from "../domain/decision.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { EventBus } from "../ports/event-bus.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import { requireDecision, requireOffer } from "./offer.service.js";

/** One request to record a proven market outcome. */
export interface MarketOutcomeRequest {
	store: OfferStorePort;
	clock: ClockPort;
	events: EventBus;
	memberId: string;
	offerId: string;
	outcome: MarketOutcome;
	runId?: string;
}

/** Closes the listing for every member through the domain, appends the event, and emits the milestone. */
export async function markOutcome(
	request: MarketOutcomeRequest,
): Promise<Decision> {
	const { store, clock, events, memberId, offerId, outcome, runId } = request;
	const offer = await requireOffer(store, offerId);
	const caller = await requireDecision(store, memberId, offerId);
	const callerClosed = recordMarketEvent(caller, outcome);
	const others = await closeOtherMembers(store, memberId, offerId, outcome);
	const closed = [callerClosed, ...others];
	await store.recordMarketOutcome({
		offer,
		decisions: closed,
		event: { outcome, observedAt: clock.now(), runId },
	});
	for (const decision of closed)
		await events.emit("offer.closed", { offer, decision });
	return callerClosed;
}

/** Closes every other member's open decision on the offer, leaving already-closed ones final. */
async function closeOtherMembers(
	store: OfferStorePort,
	memberId: string,
	offerId: string,
	outcome: MarketOutcome,
): Promise<Decision[]> {
	const others = (await store.listDecisionsForOffer(offerId)).filter(
		(decision) => decision.memberId !== memberId,
	);
	return others
		.filter((decision) => !isMarketClosed(decision.marketStatus))
		.map((decision) => recordMarketEvent(decision, outcome));
}
