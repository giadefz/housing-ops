import type { Decision } from "./decision.js";
import type { FeedEntry } from "./feed.js";
import type { Offer } from "./offer.js";

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

/** A milestone about a member's feed entry, with their judgment when they have one. */
export interface FeedEventPayload {
	offer: Offer;
	feed: FeedEntry;
	decision?: Decision;
}

/** A milestone about a member's judgment. */
export interface JudgmentEventPayload {
	offer: Offer;
	decision: Decision;
}

/** The payload each pipeline event carries. Add an entry when adding an event. */
export interface PipelineEventPayloads {
	"offer.passed": FeedEventPayload;
	"offer.updated": FeedEventPayload;
	"offer.screened": JudgmentEventPayload;
	"offer.shortlisted": JudgmentEventPayload;
	"offer.closed": JudgmentEventPayload;
}

/** The payload type for a pipeline event. */
export type PipelinePayload = PipelineEventPayloads[PipelineEvent];
