import { z } from "zod";
import { BaseConfig } from "./base.js";
import { PipelineFileSchema } from "./pipeline.js";
import { ProfileFileSchema, ProfileSchema } from "./profile.js";
import { ProvidersFileSchema } from "./providers.js";
import { PublishersFileSchema } from "./publishers.js";

export {
	ExtensionApprovalSchema,
	ExtensionsFileSchema,
	type ExtensionApproval,
} from "./extensions.js";
export {
	FilterStageSchema,
	PipelineFileSchema,
	type FilterStageConfig,
} from "./pipeline.js";
export {
	ProfileFileSchema,
	ProfileSchema,
	type Budget,
	type Profile,
} from "./profile.js";
export {
	ProviderEntrySchema,
	ProvidersFileSchema,
	type ProviderEntry,
} from "./providers.js";
export {
	PublisherEntrySchema,
	PublishersFileSchema,
	type PublisherEntry,
} from "./publishers.js";
export {
	InteractionInputSchema,
	ProfileGetSchema,
	ProfileSetSchema,
	PublishInputSchema,
	QueueInputSchema,
	VerdictInputSchema,
	type InteractionInput,
	type ProfileGetInput,
	type ProfileSetInput,
	type PublishInput,
	type QueueInput,
	type VerdictInput,
} from "./requests.js";

export const CONFIG_FILES = [
	"profile.yml",
	"pipeline.yml",
	"providers.yml",
	"publishers.yml",
	"extensions.yml",
] as const;

/** The config filenames owned by the core. */
export type ConfigFile = (typeof CONFIG_FILES)[number];

/** The schema for each config file, keyed by filename. */
export const ConfigSchemas: Record<ConfigFile, z.ZodType> = {
	"profile.yml": ProfileFileSchema,
	"pipeline.yml": PipelineFileSchema,
	"providers.yml": ProvidersFileSchema,
	"publishers.yml": PublishersFileSchema,
	"extensions.yml": BaseConfig,
};

/** A setup request: the five config documents, each preformatted by the caller. */
export const SetupInputSchema = z.object(
	Object.fromEntries(CONFIG_FILES.map((file) => [file, z.unknown()])),
);

/** The parsed setup request. */
export type SetupInput = z.infer<typeof SetupInputSchema>;
