import crypto from "node:crypto";
import type { Interaction } from "../domain/analysis.js";
import { recordUserAction } from "../domain/decision.js";
import type { InteractionResult } from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import type { InteractionInput } from "../schemas/requests.js";
import { requireDecision, requireOffer } from "./offer.service.js";

/** One request to record a user reaction on an offer. */
export interface InteractionRequest {
	store: OfferStorePort;
	clock: ClockPort;
	memberId: string;
	offerId: string;
	input: InteractionInput;
}

/** Records a reaction, moves the member's decision, and appends the interaction. */
export async function interact(
	request: InteractionRequest,
): Promise<InteractionResult> {
	const { store, clock, memberId, offerId, input } = request;
	await requireOffer(store, offerId);
	const decision = await requireDecision(store, memberId, offerId);
	const updated = recordUserAction(decision, input.action);
	const interaction = toInteraction(memberId, offerId, input, clock.now());
	await store.saveDecision(updated);
	await store.recordInteraction(interaction);
	return { interactionId: interaction.id, userStatus: updated.userStatus };
}

function toInteraction(
	memberId: string,
	offerId: string,
	input: InteractionInput,
	at: string,
): Interaction {
	return {
		id: crypto.randomUUID(),
		memberId,
		offerId,
		action: input.action,
		reason: input.reason,
		createdAt: at,
	};
}
