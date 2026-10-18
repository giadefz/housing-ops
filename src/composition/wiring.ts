import yaml from "js-yaml";
import { profileCoverageWarnings } from "../adapters/secondary/filters/coverage.js";
import {
	buildFilterStages,
	collectFilters,
} from "../adapters/secondary/filters/registry.js";
import { createEventBusBuilder } from "../adapters/secondary/publishers/event-bus-builder.js";
import type { FilterPort } from "../core/ports/filter.port.js";
import type { Profile } from "../core/schemas/profile.js";
import type {
	ApplicationDependencies,
	Boot,
	ScanContext,
	Wiring,
} from "./types.js";

/** Builds the stable wiring: config texts, event bus, filters, and scan context. */
export async function createWiring(
	root: string,
	dependencies: ApplicationDependencies,
	boot: Boot,
): Promise<Wiring> {
	const { storeFactory, writeInstance, clock, pack, warn } = dependencies;
	const { config, profile } = boot;
	const pipelineText = config === null ? null : yaml.dump(config.pipeline);
	const providersText = config === null ? null : yaml.dump(config.providers);
	const publishersText =
		config === null ? null : yaml.dump(config.publishers);
	const events = createEventBusBuilder(warn)
		.withPublishers(publishersText)
		.build();
	const filters = await collectFilters(root, boot.workspace.extensionsText);
	warnOnProfileGaps({
		profile,
		pipelineText,
		country: pack.code,
		filters,
		warn,
	});
	const scanContext: ScanContext = {
		providersText,
		events,
		pipelineText,
		pack,
		clock,
		filters,
	};
	return {
		root,
		storeFactory,
		writeInstance,
		clock,
		pack,
		events,
		filters,
		providersText,
		pipelineText,
		scanContext,
	};
}

interface ProfileGapInput {
	profile: Profile | null;
	pipelineText: string | null;
	country: string;
	filters: Map<string, FilterPort>;
	warn: (message: string) => void;
}

/** Reports profile fields and enabled filters that do not line up, at boot. */
function warnOnProfileGaps(input: ProfileGapInput): void {
	if (input.profile === null) return;
	const stages = buildFilterStages(
		input.pipelineText,
		input.country,
		input.filters,
	);
	const warnings = profileCoverageWarnings(stages, input.profile);
	for (const warning of warnings) input.warn(warning);
}
