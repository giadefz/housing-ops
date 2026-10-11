import type { MarketStatus, Offer } from "../domain/offer.js";
import type { PublishResult } from "../ports/application.port.js";
import type { EventBus } from "../ports/event-bus.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import type { PublishInput } from "../schemas/requests.js";

/** The market statuses each re-publishable event selects. */
const EVENT_STATUSES: Record<PublishInput["event"], MarketStatus[]> = {
	"offer.passed": ["passed", "pending"],
	"offer.screened": ["screened"],
	"offer.shortlisted": ["shortlisted"],
	"offer.closed": ["let", "sold", "gone"],
};

/** One request to re-deliver an event over stored offers. */
export interface PublishNowRequest {
	store: OfferStorePort;
	events: EventBus;
	input: PublishInput;
}

/** Re-delivers an event for every stored offer currently in the matching state. */
export async function publishNow(
	request: PublishNowRequest,
): Promise<PublishResult> {
	const { store, events, input } = request;
	const offers = await eligibleOffers(store, input);
	for (const offer of offers) await events.emit(input.event, { offer });
	return { event: input.event, published: offers.length };
}

async function eligibleOffers(
	store: OfferStorePort,
	input: PublishInput,
): Promise<Offer[]> {
	const offers: Offer[] = [];
	for (const status of EVENT_STATUSES[input.event]) {
		const remaining = input.limit - offers.length;
		if (remaining <= 0) break;
		offers.push(...(await store.listOffersByStatus(status, remaining)));
	}
	return offers;
}
