/** Pipeline milestones. Publishers subscribe to these. */
export const PIPELINE_EVENTS = [
	"offer.passed",
	"offer.screened",
	"offer.shortlisted",
	"offer.closed",
	"offer.updated",
] as const;

/** A pipeline milestone a publisher can subscribe to. */
export type PipelineEvent = (typeof PIPELINE_EVENTS)[number];
