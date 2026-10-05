import type { Verdict } from "../domain/verdict.js";
import type {
	FilterDecision,
	FilterInput,
	FilterPort,
} from "../ports/filter.port.js";

/** One stage of the pipeline: a filter plus its missing-data policy. */
export interface FilterStage {
	filter: FilterPort;
	missing: "skip" | "fail";
}

/** The outcome of running the pipeline over one offer. */
export interface FilterRun {
	verdicts: Verdict[];
	passed: boolean;
}

/** Runs the filters in order. An offer passes when no filter fails. */
export function runFilters(
	stages: FilterStage[],
	input: FilterInput,
): FilterRun {
	const verdicts = stages.map((stage) => judge(stage, input));
	return {
		verdicts,
		passed: verdicts.every((verdict) => verdict.outcome !== "fail"),
	};
}

function judge(stage: FilterStage, input: FilterInput): Verdict {
	const resolved = resolveMissing(
		stage.filter.evaluate(input),
		stage.missing,
	);
	return {
		filterId: stage.filter.id,
		outcome: resolved.outcome,
		reason: "reason" in resolved ? resolved.reason : "",
	};
}

function resolveMissing(
	decision: FilterDecision,
	missing: "skip" | "fail",
): FilterDecision {
	if (decision.outcome === "skip" && missing === "fail") {
		return { outcome: "fail", reason: decision.reason };
	}
	return decision;
}
