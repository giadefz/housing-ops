import yaml from "js-yaml";
import { ConfigError } from "../../../core/errors/config.js";
import { errorMessage } from "../../../core/errors/message.js";
import { bundledFilters } from "../../../core/filters/index.js";
import type { FilterSummary } from "../../../core/ports/application.port.js";
import type { FilterPort } from "../../../core/ports/filter.port.js";
import {
	PipelineFileSchema,
	type FilterStageConfig,
} from "../../../core/schemas/index.js";
import type { FilterStage } from "../../../core/services/pipeline.service.js";

/** True when the filter exists and is not scoped to another country. */
export function isFilterAvailable(
	filter: FilterPort | undefined,
	country: string,
): boolean {
	return (
		filter !== undefined &&
		(filter.country === undefined || filter.country === country)
	);
}

/** Lists the configured stages, marking any not available for the active country. */
export function listFilters(
	pipelineText: string | null,
	country: string,
): FilterSummary[] {
	return parseStages(pipelineText).map((stage) => ({
		id: stage.id,
		enabled: stage.enabled,
		missing: stage.missing,
		available: isFilterAvailable(bundledFilters.get(stage.id), country),
	}));
}

/** Builds the ordered, enabled stages whose filter is available for the active country. */
export function buildFilterStages(
	pipelineText: string | null,
	country: string,
): FilterStage[] {
	return parseStages(pipelineText)
		.filter((stage) => stage.enabled)
		.map((stage) => toFilterStage(stage, country))
		.filter((stage): stage is FilterStage => stage !== undefined);
}

function toFilterStage(
	stage: FilterStageConfig,
	country: string,
): FilterStage | undefined {
	const filter = bundledFilters.get(stage.id);
	if (filter === undefined || !isFilterAvailable(filter, country))
		return undefined;
	return { filter, missing: stage.missing };
}

function parseStages(pipelineText: string | null): FilterStageConfig[] {
	if (pipelineText === null) return [];
	const parsed = PipelineFileSchema.safeParse(loadYaml(pipelineText));
	if (!parsed.success) {
		throw new ConfigError(
			`pipeline.yml: ${parsed.error.message}`,
			parsed.error,
		);
	}
	return parsed.data.filters;
}

function loadYaml(text: string): unknown {
	try {
		return yaml.load(text);
	} catch (error) {
		throw new ConfigError(`pipeline.yml: ${errorMessage(error)}`, error);
	}
}
