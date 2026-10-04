import { z } from "zod";
import { BaseConfig } from "./base.js";
import { ProvidersFileSchema } from "./providers.js";

export {
	ExtensionApprovalSchema,
	ExtensionsFileSchema,
	type ExtensionApproval,
} from "./extensions.js";
export {
	ProviderEntrySchema,
	ProvidersFileSchema,
	type ProviderEntry,
} from "./providers.js";

export const CONFIG_FILES = [
	"profile.yml",
	"pipeline.yml",
	"providers.yml",
	"extensions.yml",
] as const;

/** The config filenames owned by the core. */
export type ConfigFile = (typeof CONFIG_FILES)[number];

/** The schema for each config file, keyed by filename. */
export const ConfigSchemas: Record<ConfigFile, z.ZodType> = {
	"profile.yml": BaseConfig,
	"pipeline.yml": BaseConfig,
	"providers.yml": ProvidersFileSchema,
	"extensions.yml": BaseConfig,
};
