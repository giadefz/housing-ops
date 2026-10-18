import type {
	PipelineEvent,
	PipelinePayload,
} from "../../core/domain/events.js";
import { errorMessage } from "../../core/errors/message.js";
import type { EventBus } from "../../core/ports/event-bus.port.js";

type AnyHandler = (payload: PipelinePayload) => void | Promise<void>;

/** An in-process event bus: handlers subscribe per event, emit notifies them best-effort. */
export function createEventBus(log: (message: string) => void): EventBus {
	const handlers = new Map<PipelineEvent, Set<AnyHandler>>();
	return {
		on(event, handler) {
			const set = handlers.get(event) ?? new Set();
			set.add(handler as AnyHandler);
			handlers.set(event, set);
		},
		async emit(event, payload) {
			for (const handler of handlers.get(event) ?? []) {
				try {
					await handler(payload);
				} catch (error) {
					log(
						`event ${event} handler failed: ${errorMessage(error)}`,
					);
				}
			}
		},
	};
}
