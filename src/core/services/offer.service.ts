import { openDecision, type Decision } from "../domain/decision.js";
import { OfferNotFoundError } from "../errors/offer.js";
import type { Offer } from "../domain/offer.js";
import type { OfferDetail } from "../ports/application.port.js";
import type { OfferStorePort } from "../ports/store.port.js";

/** Loads one offer with a member's decision, feed entry, analyses, interactions, and the pool's verdicts. */
export async function getOffer(
	store: OfferStorePort,
	memberId: string,
	offerId: string,
): Promise<OfferDetail> {
	const offer = await requireOffer(store, offerId);
	const decision = await store.findDecision(memberId, offerId);
	const feed = await store.findFeedEntry(memberId, offerId);
	const analyses = await store.listAnalyses(memberId, offerId);
	const interactions = await store.listInteractions(memberId, offerId);
	const verdicts = await store.listVerdicts(offerId);
	return {
		offer,
		analyses,
		interactions,
		verdicts,
		...(decision === null ? {} : { decision }),
		...(feed === null ? {} : { feed }),
	};
}

/** Loads one offer, or throws when it is not stored. */
export async function requireOffer(
	store: OfferStorePort,
	id: string,
): Promise<Offer> {
	const offer = await store.findOffer(id);
	if (offer === null) throw new OfferNotFoundError(id);
	return offer;
}

/** Loads a member's decision on an offer, opening a fresh one when the member has not acted. */
export async function findOrOpenDecision(
	store: OfferStorePort,
	memberId: string,
	offerId: string,
): Promise<Decision> {
	const decision = await store.findDecision(memberId, offerId);
	return decision ?? openDecision(memberId, offerId);
}
