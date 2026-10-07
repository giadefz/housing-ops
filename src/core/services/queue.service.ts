import { isOfferStatus } from "../domain/offer.js";
import { UnknownStatusError } from "../errors/offer.js";
import type { QueueResult } from "../ports/application.port.js";
import type { OfferStorePort } from "../ports/store.port.js";

/** One request for a page of the queue. */
export interface QueueRequest {
	store: OfferStorePort;
	status: string;
	limit: number;
}

/** Lists one page of offers with the given status, plus that status's total. */
export async function listQueue(request: QueueRequest): Promise<QueueResult> {
	const { store, status, limit } = request;
	if (!isOfferStatus(status)) throw new UnknownStatusError(status);
	const offers = await store.listQueue(status, limit);
	return { offers, total: await store.countOffersByStatus(status) };
}
