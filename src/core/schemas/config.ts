import { z } from "zod";
import { PipelineFileSchema } from "./pipeline.js";
import { ProvidersFileSchema } from "./providers.js";
import { PublishersFileSchema } from "./publishers.js";

/** The shared, admin-editable config document: pipeline, providers, publishers. */
export const ConfigSchema = z.object({
	pipeline: PipelineFileSchema,
	providers: ProvidersFileSchema,
	publishers: PublishersFileSchema,
});

/** The parsed shared config. */
export type Config = z.infer<typeof ConfigSchema>;
