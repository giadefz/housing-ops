import { OfferNotFoundError } from "../errors/offer.js";
import type { Offer } from "../domain/offer.js";
import type { OfferDetail } from "../ports/application.port.js";
import type { OfferStorePort } from "../ports/store.port.js";

/** Loads one offer with its versions, analyses, interactions, and verdicts. */
export async function getOffer(
	store: OfferStorePort,
	id: string,
): Promise<OfferDetail> {
	const offer = await requireOffer(store, id);
	const verdicts = await store.listVerdicts(id);
	return { offer, verdicts };
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
