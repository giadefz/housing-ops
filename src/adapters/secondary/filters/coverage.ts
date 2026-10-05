import type { ProfileKey } from "../../../core/ports/filter.port.js";
import type { Profile } from "../../../core/schemas/index.js";
import type { FilterStage } from "../../../core/services/pipeline.service.js";

const PROFILE_KEYS: ProfileKey[] = [
	"budget",
	"areas",
	"layouts",
	"bedrooms",
	"minSizeM2",
];

/**
 * Warnings for a profile field and an enabled filter that do not line up, in
 * either direction. Non-fatal: the run continues with the mismatch ignored.
 */
export function profileCoverageWarnings(
	stages: FilterStage[],
	profile: Profile,
): string[] {
	const declared = new Set(
		stages.flatMap((stage) => stage.filter.reads ?? []),
	);
	const missing = stages.flatMap((stage) =>
		(stage.filter.reads ?? [])
			.filter((key) => isUnset(profile[key]))
			.map(
				(key) =>
					`filter "${stage.filter.id}" reads profile.${key}, which is not set`,
			),
	);
	const ignored = PROFILE_KEYS.filter(
		(key) => !declared.has(key) && !isUnset(profile[key]),
	).map(
		(key) =>
			`profile.${key} is set but no enabled filter reads it (ignored)`,
	);
	return [...missing, ...ignored];
}

function isUnset(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (Array.isArray(value)) return value.length === 0;
	return false;
}
