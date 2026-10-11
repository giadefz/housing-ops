import type { PipelineEvent, PipelineEventPayloads } from "../domain/events.js";

/** One subscriber's dispatch outcome. */
export interface DispatchOutcome {
	subscriber: string;
	event: PipelineEvent;
	ok: boolean;
	error?: string;
}

/** Emits pipeline events to their subscribers, in-process and best-effort. */
export interface EventPort {
	emit<E extends PipelineEvent>(
		event: E,
		payload: PipelineEventPayloads[E],
	): Promise<DispatchOutcome[]>;
}
