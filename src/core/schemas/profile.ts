import { z } from "zod";
import { LAYOUT_TYPES } from "../domain/dwelling.js";
import { MARKETS } from "../domain/offer.js";

const BudgetSchema = z.object({
	max: z.number().positive(),
	currency: z.string().min(1),
	min: z.number().positive().optional(),
});

/** The default feed size: how many unjudged offers to keep. */
export const DEFAULT_FEED_TARGET = 50;

/** The default feed batch: how many pool rows one fill reads. */
export const DEFAULT_FEED_BATCH = 100;

/** The user's stated search (profile.yml). */
export const ProfileSchema = z
	.object({
		market: z.enum(MARKETS),
		country: z.string().min(1),
		budget: BudgetSchema,
		areas: z.array(z.string()).default([]),
		layouts: z.array(z.enum(LAYOUT_TYPES)).optional(),
		bedrooms: z
			.object({
				min: z.number().int().nonnegative().optional(),
				max: z.number().int().nonnegative().optional(),
			})
			.optional(),
		minSizeM2: z.number().positive().optional(),
		dealBreakers: z.array(z.string()).optional(),
		notes: z.string().optional(),
		gate: z.boolean().default(true),
		recheckHours: z.number().positive().default(48),
		feed: z
			.object({
				target: z
					.number()
					.int()
					.positive()
					.default(DEFAULT_FEED_TARGET),
				batch: z.number().int().positive().default(DEFAULT_FEED_BATCH),
			})
			.optional(),
	})
	.catchall(z.unknown());

export type Profile = z.infer<typeof ProfileSchema>;
export type Budget = z.infer<typeof BudgetSchema>;

/** The profile.yml file: the profile fields plus a version. */
export const ProfileFileSchema = ProfileSchema.extend({
	version: z.literal(1),
});
