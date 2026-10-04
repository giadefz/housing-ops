import yaml from "js-yaml";
import { ConfigError } from "../../../core/errors/config.js";
import { errorMessage } from "../../../core/errors/message.js";
import type { ProviderSummary } from "../../../core/ports/application.port.js";
import type { ProviderPort } from "../../../core/ports/provider.port.js";
import {
	ProvidersFileSchema,
	type ProviderEntry,
} from "../../../core/schemas/index.js";
import { createProcessAdapter } from "./process-adapter.js";

/** Builds providers from the providers.yml text, keyed by id. An invalid file throws. */
export function buildProviders(
	providersText: string | null,
): Map<string, ProviderPort> {
	if (providersText === null) return new Map();
	const providers = new Map<string, ProviderPort>();
	for (const entry of parseProviders(providersText)) {
		providers.set(entry.id, createProcessAdapter(entry));
	}
	return providers;
}

/** Lists the configured providers, as written in providers.yml. */
export function listProviderSummaries(
	providersText: string | null,
): ProviderSummary[] {
	if (providersText === null) return [];
	return parseProviders(providersText).map(toSummary);
}

function toSummary(entry: ProviderEntry): ProviderSummary {
	return {
		id: entry.id,
		type: entry.type,
		country: entry.country,
		markets: entry.markets,
		enabled: entry.enabled,
	};
}

function parseProviders(providersText: string): ProviderEntry[] {
	const parsed = ProvidersFileSchema.safeParse(loadYaml(providersText));
	if (!parsed.success) {
		throw new ConfigError(
			`providers.yml: ${parsed.error.message}`,
			parsed.error,
		);
	}
	return parsed.data.providers;
}

function loadYaml(text: string): unknown {
	try {
		return yaml.load(text);
	} catch (error) {
		throw new ConfigError(`providers.yml: ${errorMessage(error)}`, error);
	}
}
