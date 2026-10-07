import yaml from "js-yaml";
import { ConfigError } from "../../../core/errors/config.js";
import { errorMessage } from "../../../core/errors/message.js";
import {
	PublishersFileSchema,
	type PublisherEntry,
} from "../../../core/schemas/index.js";

/** Parses publishers.yml into its entries. An invalid file throws. */
export function parsePublishers(
	publishersText: string | null,
): PublisherEntry[] {
	if (publishersText === null) return [];
	const parsed = PublishersFileSchema.safeParse(loadYaml(publishersText));
	if (!parsed.success) {
		throw new ConfigError(
			`publishers.yml: ${parsed.error.message}`,
			parsed.error,
		);
	}
	return parsed.data.publishers;
}

function loadYaml(text: string): unknown {
	try {
		return yaml.load(text);
	} catch (error) {
		throw new ConfigError(`publishers.yml: ${errorMessage(error)}`, error);
	}
}
