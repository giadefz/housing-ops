import type { QueueResult } from "../ports/application.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import type { QueueInput } from "../schemas/requests.js";

/** One request for a page of the queue. */
export interface QueueRequest {
	store: OfferStorePort;
	input: QueueInput;
}

/** Lists one page of offers with the given status, plus that status's total. */
export async function listQueue(request: QueueRequest): Promise<QueueResult> {
	const { store, input } = request;
	const offers = await store.listQueue(input.status, input.limit);
	return { offers, total: await store.countOffersByStatus(input.status) };
}
