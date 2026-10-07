import { z } from "zod";
import { PIPELINE_EVENTS } from "../domain/events.js";

/** One publisher entry from publishers.yml. */
export const PublisherEntrySchema = z.object({
	id: z.string().min(1),
	type: z.literal("process"),
	enabled: z.boolean().default(true),
	events: z.array(z.enum(PIPELINE_EVENTS)).min(1),
	command: z.string().min(1),
	args: z.array(z.string()).default([]),
	env: z.record(z.string(), z.string()).default({}),
	timeoutMs: z.number().int().positive().optional(),
});

export type PublisherEntry = z.infer<typeof PublisherEntrySchema>;

/** The publishers.yml file. */
export const PublishersFileSchema = z
	.object({
		version: z.literal(1),
		publishers: z.array(PublisherEntrySchema).default([]),
	})
	.catchall(z.unknown());
