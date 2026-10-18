import { buildFilterStages } from "../../adapters/secondary/filters/registry.js";
import type { OffersPort } from "../../core/ports/application.port.js";
import {
	emptyFeed,
	fillFeed,
	getFeedStatus,
} from "../../core/services/feed.service.js";
import { getOffer } from "../../core/services/offer.service.js";
import { listQueue } from "../../core/services/queue.service.js";
import { memberProfile, withStore } from "../store.js";
import type { Wiring } from "../types.js";

/** Offer reads and the member's feed. */
export function offersModule(wiring: Wiring): OffersPort {
	const { root, storeFactory, events, filters, pipelineText, pack } = wiring;
	return {
		getOffer: (input) =>
			withStore(storeFactory, root, (store) =>
				getOffer(store, input.memberId, input.offerId),
			),
		listQueue: (input) =>
			withStore(storeFactory, root, (store) =>
				listQueue({
					store,
					memberId: input.memberId,
					input: input.queue,
				}),
			),
		getFeedStatus: (input) =>
			withStore(storeFactory, root, (store) =>
				getFeedStatus({ store, memberId: input.memberId }),
			),
		fillFeed: (input) =>
			withStore(storeFactory, root, async (store) =>
				fillFeed({
					store,
					events,
					profile: await memberProfile(store, input.memberId),
					filters: buildFilterStages(
						pipelineText,
						pack.code,
						filters,
					),
					memberId: input.memberId,
				}),
			),
		emptyFeed: (input) =>
			withStore(storeFactory, root, (store) =>
				emptyFeed({ store, memberId: input.memberId }),
			),
	};
}
