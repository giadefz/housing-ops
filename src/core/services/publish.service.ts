import type { MarketStatus } from "../domain/decision.js";
import type { PublishResult } from "../ports/application.port.js";
import type { EventBus } from "../ports/event-bus.port.js";
import type { MemberOffer, OfferStorePort } from "../ports/store.port.js";
import type { PublishInput } from "../schemas/requests.js";

/** The market statuses each re-publishable event selects. */
const EVENT_STATUSES: Record<PublishInput["event"], MarketStatus[]> = {
	"offer.passed": ["passed", "pending"],
	"offer.screened": ["screened"],
	"offer.shortlisted": ["shortlisted"],
	"offer.closed": ["let", "sold", "gone"],
};

/** One request to re-deliver an event over a member's stored offers. */
export interface PublishNowRequest {
	store: OfferStorePort;
	events: EventBus;
	memberId: string;
	input: PublishInput;
}

/** Re-delivers an event for every member offer currently in the matching state. */
export async function publishNow(
	request: PublishNowRequest,
): Promise<PublishResult> {
	const { store, events, memberId, input } = request;
	const members = await eligibleOffers(store, memberId, input);
	for (const { offer, decision } of members) {
		await events.emit(input.event, { offer, decision });
	}
	return { event: input.event, published: members.length };
}

async function eligibleOffers(
	store: OfferStorePort,
	memberId: string,
	input: PublishInput,
): Promise<MemberOffer[]> {
	const members: MemberOffer[] = [];
	for (const status of EVENT_STATUSES[input.event]) {
		const remaining = input.limit - members.length;
		if (remaining <= 0) break;
		members.push(
			...(await store.listMemberOffers(memberId, {
				status,
				limit: remaining,
			})),
		);
	}
	return members;
}
