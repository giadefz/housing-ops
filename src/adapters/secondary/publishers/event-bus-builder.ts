import type { EventBus } from "../../../core/ports/event-bus.port.js";
import { createEventBus } from "../event-bus.js";
import { buildPublishers } from "./registry.js";

/** A fluent builder that wires publishers into an event bus. */
export interface EventBusBuilder {
	/** Parses publishers.yml and subscribes each publisher to its events. */
	withPublishers(publishersText: string | null): EventBusBuilder;
	build(): EventBus;
}

/** Starts building an event bus; call `withPublishers` to attach the config publishers. */
export function createEventBusBuilder(
	log: (message: string) => void,
): EventBusBuilder {
	const bus = createEventBus(log);
	const builder: EventBusBuilder = {
		withPublishers(publishersText) {
			for (const publisher of buildPublishers(publishersText))
				for (const event of publisher.subscriptions)
					bus.on(event, (payload) =>
						publisher.publish(event, payload),
					);
			return builder;
		},
		build: () => bus,
	};
	return builder;
}
