import yaml from "js-yaml";
import { ConfigError } from "../../../core/errors/config.js";
import { errorMessage } from "../../../core/errors/message.js";
import { ProvidersFileSchema } from "../../../core/schemas/index.js";
import type { ProviderPort } from "../../../core/ports/provider.port.js";
import { createCommandProvider } from "./command-provider.js";

/** Builds providers from the providers.yml text, keyed by id. An invalid file throws. */
export function buildProviders(
	providersText: string | null,
): Map<string, ProviderPort> {
	if (providersText === null) return new Map();
	const parsed = ProvidersFileSchema.safeParse(loadYaml(providersText));
	if (!parsed.success) {
		throw new ConfigError(
			`providers.yml: ${parsed.error.message}`,
			parsed.error,
		);
	}
	const providers = new Map<string, ProviderPort>();
	for (const entry of parsed.data.providers) {
		providers.set(entry.id, createCommandProvider(entry));
	}
	return providers;
}

function loadYaml(text: string): unknown {
	try {
		return yaml.load(text);
	} catch (error) {
		throw new ConfigError(`providers.yml: ${errorMessage(error)}`, error);
	}
}
