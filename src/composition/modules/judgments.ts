import type { JudgmentsPort } from "../../core/ports/application.port.js";
import { buildDigest } from "../../core/services/digest.service.js";
import { interact } from "../../core/services/interaction.service.js";
import { publishNow } from "../../core/services/publish.service.js";
import { setVerdict } from "../../core/services/verdict.service.js";
import { memberProfile, withStore } from "../store.js";
import type { Wiring } from "../types.js";

/** Judgments, reactions, learning, and re-publishing. */
export function judgmentsModule(wiring: Wiring): JudgmentsPort {
	const { root, storeFactory, clock, events } = wiring;
	return {
		setVerdict: (input) =>
			withStore(storeFactory, root, (store) =>
				setVerdict({
					store,
					clock,
					events,
					memberId: input.memberId,
					offerId: input.offerId,
					input: input.verdict,
				}),
			),
		interact: (input) =>
			withStore(storeFactory, root, (store) =>
				interact({
					store,
					clock,
					memberId: input.memberId,
					offerId: input.offerId,
					input: input.interaction,
				}),
			),
		getDigest: (input) =>
			withStore(storeFactory, root, async (store) =>
				buildDigest({
					store,
					clock,
					profile: await memberProfile(store, input.memberId),
					memberId: input.memberId,
				}),
			),
		publishNow: (input) =>
			withStore(storeFactory, root, (store) =>
				publishNow({
					store,
					events,
					memberId: input.memberId,
					input: input.publish,
				}),
			),
	};
}
