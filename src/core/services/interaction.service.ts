import crypto from "node:crypto";
import type { Interaction } from "../domain/analysis.js";
import { recordUserAction } from "../domain/offer.js";
import type { InteractionResult } from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import type { InteractionInput } from "../schemas/requests.js";
import { requireOffer } from "./offer.service.js";

/** One request to record a user reaction on an offer. */
export interface InteractionRequest {
	store: OfferStorePort;
	clock: ClockPort;
	id: string;
	input: InteractionInput;
}

/** Records a reaction, moves the offer's status, and appends the interaction. */
export async function interact(
	request: InteractionRequest,
): Promise<InteractionResult> {
	const { store, clock, id, input } = request;
	const offer = await requireOffer(store, id);
	const updated = recordUserAction(offer, input.action);
	const interaction = toInteraction(id, input, clock.now());
	await store.saveOffer(updated);
	await store.recordInteraction(interaction);
	return { interactionId: interaction.id, userStatus: updated.userStatus };
}

function toInteraction(
	id: string,
	input: InteractionInput,
	at: string,
): Interaction {
	return {
		id: crypto.randomUUID(),
		offerId: id,
		action: input.action,
		reason: input.reason,
		createdAt: at,
	};
}
