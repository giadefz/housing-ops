import type { PipelineEvent, PipelineEventPayloads } from "../domain/events.js";

/** A handler for one pipeline event. */
export type EventHandler<E extends PipelineEvent> = (
	payload: PipelineEventPayloads[E],
) => void | Promise<void>;

/** An in-process event bus: handlers subscribe to events; emit notifies them. */
export interface EventBus {
	on<E extends PipelineEvent>(event: E, handler: EventHandler<E>): void;
	emit<E extends PipelineEvent>(
		event: E,
		payload: PipelineEventPayloads[E],
	): Promise<void>;
}
