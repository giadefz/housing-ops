import { z } from "zod";
import {
	ANALYSIS_TIERS,
	ANALYSIS_VERDICTS,
	INTERACTION_ACTIONS,
} from "../domain/analysis.js";
import { QUEUE_VIEWS } from "../domain/queue.js";

/** A verdict set request: a tier, a verdict, and its evidence. */
export const VerdictInputSchema = z.object({
	tier: z.enum(ANALYSIS_TIERS),
	verdict: z.enum(ANALYSIS_VERDICTS),
	reason: z.string().min(1),
	pros: z.array(z.string()).optional(),
	cons: z.array(z.string()).optional(),
	priceAssessment: z.string().optional(),
	redFlags: z.array(z.string()).optional(),
	recommendation: z.string().optional(),
	confidence: z.number().min(0).max(1).optional(),
});

/** The parsed verdict request. */
export type VerdictInput = z.infer<typeof VerdictInputSchema>;

/** An interact request: an action and an optional reason. */
export const InteractionInputSchema = z.object({
	action: z.enum(INTERACTION_ACTIONS),
	reason: z.string().optional(),
});

/** The parsed interact request. */
export type InteractionInput = z.infer<typeof InteractionInputSchema>;

/** A queue request: which view, and how many rows. */
export const QueueInputSchema = z.object({
	status: z.enum(QUEUE_VIEWS).default("to-evaluate"),
	limit: z.number().int().positive().default(20),
});

/** The parsed queue request. */
export type QueueInput = z.infer<typeof QueueInputSchema>;

/** A profile get request: an optional dotted path. */
export const ProfileGetSchema = z.object({
	path: z.string().min(1).optional(),
});

/** The parsed profile get request. */
export type ProfileGetInput = z.infer<typeof ProfileGetSchema>;

/** A profile set request: a dotted path and its JSON value. */
export const ProfileSetSchema = z.object({
	path: z.string().min(1),
	value: z.unknown(),
});

/** The parsed profile set request. */
export type ProfileSetInput = z.infer<typeof ProfileSetSchema>;

/** The events `publish now` can re-deliver (the state milestones). */
export const PUBLISH_EVENTS = [
	"offer.passed",
	"offer.screened",
	"offer.shortlisted",
	"offer.closed",
] as const;

/** A publish request: which event to re-deliver, and how many offers. */
export const PublishInputSchema = z.object({
	event: z.enum(PUBLISH_EVENTS).default("offer.passed"),
	limit: z.number().int().positive().default(20),
});

/** The parsed publish request. */
export type PublishInput = z.infer<typeof PublishInputSchema>;
