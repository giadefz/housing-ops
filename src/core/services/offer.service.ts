import { OfferNotFoundError } from "../domain/offer.js";
import type { OfferDetail } from "../ports/application.port.js";
import type { OfferStorePort } from "../ports/store.port.js";

/** Loads one offer with its versions, analyses, interactions, and verdicts. Throws when unknown. */
export async function getOffer(
	store: OfferStorePort,
	id: string,
): Promise<OfferDetail> {
	const offer = await store.findOffer(id);
	if (offer === null) throw new OfferNotFoundError(id);
	const verdicts = await store.listVerdicts(id);
	return { offer, verdicts };
}
