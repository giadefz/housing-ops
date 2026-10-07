import type { PipelineEvent } from "../domain/events.js";
import { errorMessage } from "../errors/message.js";
import type { PublisherPort } from "../ports/publisher.port.js";

/** One delivery attempt's result. */
export interface PublishOutcome {
	publisher: string;
	event: PipelineEvent;
	ok: boolean;
	error?: string;
}

/** Delivers an event to its subscribers, best-effort. Never throws. */
export async function deliver(
	publishers: PublisherPort[],
	event: PipelineEvent,
	payload: unknown,
): Promise<PublishOutcome[]> {
	const outcomes: PublishOutcome[] = [];
	for (const publisher of publishers) {
		if (!publisher.subscriptions.includes(event)) continue;
		outcomes.push(await deliverOne(publisher, event, payload));
	}
	return outcomes;
}

async function deliverOne(
	publisher: PublisherPort,
	event: PipelineEvent,
	payload: unknown,
): Promise<PublishOutcome> {
	try {
		await publisher.publish(event, payload);
		return { publisher: publisher.id, event, ok: true };
	} catch (error) {
		return {
			publisher: publisher.id,
			event,
			ok: false,
			error: errorMessage(error),
		};
	}
}
