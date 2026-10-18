import type { Decision } from "./decision.js";
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

/** The subject offer, and the member's standing on it, every pipeline event carries. */
export interface OfferEventPayload {
	offer: Offer;
	decision: Decision;
}

/** The payload each pipeline event carries. Add an entry when adding an event. */
export interface PipelineEventPayloads {
	"offer.passed": OfferEventPayload;
	"offer.screened": OfferEventPayload;
	"offer.shortlisted": OfferEventPayload;
	"offer.closed": OfferEventPayload;
	"offer.updated": OfferEventPayload;
}

/** The payload type for a pipeline event. */
export type PipelinePayload = PipelineEventPayloads[PipelineEvent];
