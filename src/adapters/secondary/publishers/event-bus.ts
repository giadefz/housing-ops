import type {
	PipelineEvent,
	PipelineEventPayloads,
	PipelinePayload,
} from "../../../core/domain/events.js";
import { errorMessage } from "../../../core/errors/message.js";
import type {
	DispatchOutcome,
	EventPort,
} from "../../../core/ports/event.port.js";
import type { PublisherPort } from "../../../core/ports/publisher.port.js";

/** The in-process event bus: routes each event to its subscribed publishers, best-effort. */
export function createEventBus(
	publishers: PublisherPort[],
	log: (message: string) => void,
): EventPort {
	return {
		async emit<E extends PipelineEvent>(
			event: E,
			payload: PipelineEventPayloads[E],
		) {
			const outcomes: DispatchOutcome[] = [];
			for (const publisher of publishers) {
				if (!publisher.subscriptions.includes(event)) continue;
				outcomes.push(await dispatch(publisher, event, payload, log));
			}
			return outcomes;
		},
	};
}

async function dispatch(
	publisher: PublisherPort,
	event: PipelineEvent,
	payload: PipelinePayload,
	log: (message: string) => void,
): Promise<DispatchOutcome> {
	try {
		await publisher.publish(event, payload);
		return { subscriber: publisher.id, event, ok: true };
	} catch (error) {
		const message = errorMessage(error);
		log(`publisher ${publisher.id} failed on ${event}: ${message}`);
		return { subscriber: publisher.id, event, ok: false, error: message };
	}
}
