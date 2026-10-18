import type { QueueResult } from "../ports/application.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import type { QueueInput } from "../schemas/requests.js";

/** One request for a page of a member's queue. */
export interface QueueRequest {
	store: OfferStorePort;
	memberId: string;
	input: QueueInput;
}

/** Lists one page of one queue view, plus that view's total. */
export async function listQueue(request: QueueRequest): Promise<QueueResult> {
	const { store, memberId, input } = request;
	const offers = await store.listQueue(memberId, {
		view: input.status,
		limit: input.limit,
	});
	return {
		offers,
		total: await store.countQueue(memberId, input.status),
	};
}
