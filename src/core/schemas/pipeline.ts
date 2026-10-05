import { z } from "zod";

/** One configured filter stage. */
export const FilterStageSchema = z.object({
	id: z.string().min(1),
	enabled: z.boolean().default(true),
	missing: z.enum(["skip", "fail"]).default("skip"),
});

export type FilterStageConfig = z.infer<typeof FilterStageSchema>;

/** The pipeline.yml file. */
export const PipelineFileSchema = z
	.object({
		version: z.literal(1),
		filters: z.array(FilterStageSchema).default([]),
	})
	.catchall(z.unknown());
