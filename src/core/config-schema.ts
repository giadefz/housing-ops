import { z } from "zod";

export const CONFIG_FILES = [
	"profile.yml",
	"pipeline.yml",
	"providers.yml",
	"extensions.yml",
] as const;

/** The config filenames owned by the core. */
export type ConfigFile = (typeof CONFIG_FILES)[number];

const BaseConfig = z.object({ version: z.literal(1) }).catchall(z.unknown());

export const ConfigSchemas: Record<ConfigFile, typeof BaseConfig> = {
	"profile.yml": BaseConfig,
	"pipeline.yml": BaseConfig,
	"providers.yml": BaseConfig,
	"extensions.yml": BaseConfig,
};

export const ExtensionApprovalSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(["filter", "provider", "publisher", "storage"]),
	path: z.string().min(1),
	sha256: z.string().min(1),
	approved_at: z.coerce.string().min(1),
});

/** An approved extension: its kind, location, hash, and approval time. */
export type ExtensionApproval = z.infer<typeof ExtensionApprovalSchema>;

export const ExtensionsFileSchema = z
	.object({
		version: z.literal(1),
		approvals: z.array(z.unknown()).optional(),
	})
	.catchall(z.unknown());
