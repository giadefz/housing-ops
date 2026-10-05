import yaml from "js-yaml";
import { ConfigError } from "../../../core/errors/config.js";
import { errorMessage } from "../../../core/errors/message.js";
import { bundledFilters } from "../../../core/filters/index.js";
import type { FilterSummary } from "../../../core/ports/application.port.js";
import {
	PipelineFileSchema,
	type FilterStageConfig,
} from "../../../core/schemas/index.js";
import type { FilterStage } from "../../../core/services/pipeline.service.js";

/** Lists the configured filter stages, marking any no bundled filter provides. */
export function listFilters(pipelineText: string | null): FilterSummary[] {
	return parseStages(pipelineText).map((stage) => ({
		id: stage.id,
		enabled: stage.enabled,
		missing: stage.missing,
		available: bundledFilters.has(stage.id),
	}));
}

/** Builds the ordered, enabled filter stages. Ids with no filter are dropped. */
export function buildFilterStages(pipelineText: string | null): FilterStage[] {
	return parseStages(pipelineText)
		.filter((stage) => stage.enabled)
		.flatMap((stage) => {
			const filter = bundledFilters.get(stage.id);
			return filter === undefined
				? []
				: [{ filter, missing: stage.missing }];
		});
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
