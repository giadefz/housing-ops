import type { PipelineEvent } from "../domain/events.js";

/** Carries a pipeline event elsewhere. Never judges, never mutates the store. */
export interface PublisherPort {
	id: string;
	subscriptions: readonly PipelineEvent[];
	publish(event: PipelineEvent, payload: unknown): Promise<void>;
}
