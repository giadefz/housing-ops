import { z } from "zod";
import { MARKETS } from "../domain/offer.js";

/** One provider entry from providers.yml. */
export const ProviderEntrySchema = z.object({
	id: z.string().min(1),
	type: z.literal("command"),
	country: z.string().min(1),
	markets: z.array(z.enum(MARKETS)).min(1),
	enabled: z.boolean().default(true),
	command: z.string().min(1),
	args: z.array(z.string()).default([]),
	env: z.record(z.string(), z.string()).default({}),
	output: z.enum(["jsonl", "json"]).default("jsonl"),
	timeoutMs: z.number().int().positive().optional(),
});

export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;

/** The providers.yml file. */
export const ProvidersFileSchema = z
	.object({
		version: z.literal(1),
		providers: z.array(ProviderEntrySchema).default([]),
	})
	.catchall(z.unknown());
