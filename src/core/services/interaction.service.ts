import crypto from "node:crypto";
import type { Interaction } from "../domain/analysis.js";
import {
	isUserAction,
	recordUserAction,
	type UserAction,
} from "../domain/offer.js";
import { OfferNotFoundError, UnknownActionError } from "../errors/offer.js";
import type {
	InteractionInput,
	InteractionResult,
} from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { OfferStorePort } from "../ports/store.port.js";

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
	const offer = await store.findOffer(id);
	if (offer === null) throw new OfferNotFoundError(id);
	const action = parseAction(input.action);
	const updated = recordUserAction(offer, action);
	const interaction = toInteraction({ id, action, input, at: clock.now() });
	await store.saveOffer(updated);
	await store.recordInteraction(interaction);
	return { interactionId: interaction.id, status: updated.status };
}

function parseAction(value: string): UserAction {
	if (!isUserAction(value)) throw new UnknownActionError(value);
	return value;
}

interface InteractionSource {
	id: string;
	action: UserAction;
	input: InteractionInput;
	at: string;
}

function toInteraction(source: InteractionSource): Interaction {
	return {
		id: crypto.randomUUID(),
		offerId: source.id,
		action: source.action,
		reason: source.input.reason,
		createdAt: source.at,
	};
}
