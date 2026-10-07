import { z } from "zod";
import {
	ANALYSIS_TIERS,
	ANALYSIS_VERDICTS,
	INTERACTION_ACTIONS,
} from "../domain/analysis.js";

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
