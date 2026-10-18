import type { MarketStatus } from "../domain/decision.js";
import type { PublishResult } from "../ports/application.port.js";
import type { EventBus } from "../ports/event-bus.port.js";
import type { MemberOffer, OfferStorePort } from "../ports/store.port.js";
import type { PublishInput } from "../schemas/requests.js";

/** The events re-delivered from a member's feed rather than their judgments. */
type FeedEvent = "offer.passed";

/** A re-publishable judgment event. */
type JudgmentEvent = Exclude<PublishInput["event"], FeedEvent>;

/** The market statuses each judgment event selects. */
const EVENT_STATUSES: Record<JudgmentEvent, MarketStatus[]> = {
	"offer.screened": ["screened"],
	"offer.shortlisted": ["shortlisted"],
	"offer.closed": ["let", "sold", "gone"],
};

/** One request to re-deliver an event over a member's feed or decisions. */
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
	if (input.event === "offer.passed")
		return publishFeed(store, events, memberId, input.limit);
	const members = await eligibleOffers(
		store,
		memberId,
		input.event,
		input.limit,
	);
	for (const { offer, decision } of members)
		await events.emit(input.event, { offer, decision });
	return { event: input.event, published: members.length };
}

async function publishFeed(
	store: OfferStorePort,
	events: EventBus,
	memberId: string,
	limit: number,
): Promise<PublishResult> {
	const feed = await store.listFeedOffers(memberId, limit);
	for (const { offer, feed: entry } of feed)
		await events.emit("offer.passed", { offer, feed: entry });
	return { event: "offer.passed", published: feed.length };
}

async function eligibleOffers(
	store: OfferStorePort,
	memberId: string,
	event: JudgmentEvent,
	limit: number,
): Promise<MemberOffer[]> {
	const members: MemberOffer[] = [];
	for (const status of EVENT_STATUSES[event]) {
		const remaining = limit - members.length;
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
