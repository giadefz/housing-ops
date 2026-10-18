import yaml from "js-yaml";
import { ConfigError } from "../../../core/errors/config.js";
import { errorMessage } from "../../../core/errors/message.js";
import type { PublisherPort } from "../../../core/ports/publisher.port.js";
import {
	PublishersFileSchema,
	type PublisherEntry,
} from "../../../core/schemas/index.js";
import { createProcessPublisher } from "./process-publisher.js";

/** Builds the enabled publishers from the publishers config text. An invalid file throws. */
export function buildPublishers(
	publishersText: string | null,
): PublisherPort[] {
	return parsePublishers(publishersText)
		.filter((entry) => entry.enabled)
		.map((entry) => createProcessPublisher(entry));
}

/** Parses the publishers config into its entries. An invalid file throws. */
export function parsePublishers(
	publishersText: string | null,
): PublisherEntry[] {
	if (publishersText === null) return [];
	const parsed = PublishersFileSchema.safeParse(loadYaml(publishersText));
	if (!parsed.success) {
		throw new ConfigError(
			`config.publishers: ${parsed.error.message}`,
			parsed.error,
		);
	}
	return parsed.data.publishers;
}

function loadYaml(text: string): unknown {
	try {
		return yaml.load(text);
	} catch (error) {
		throw new ConfigError(
			`config.publishers: ${errorMessage(error)}`,
			error,
		);
	}
}
