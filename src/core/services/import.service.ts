import type { z } from "zod";
import { ConfigError } from "../errors/config.js";
import { ConfigSchema } from "../schemas/config.js";
import type { InitInput } from "../schemas/init.js";
import { InstanceSchema } from "../schemas/instance.js";
import { ProfileFileSchema } from "../schemas/profile.js";

/** The legacy config documents, parsed from their YAML files. */
export interface LegacyConfigDocuments {
	profile: unknown;
	pipeline: unknown;
	providers: unknown;
	publishers: unknown;
}

/** One request to turn legacy config files into bootstrap input. */
export interface ImportConfigRequest {
	documents: LegacyConfigDocuments;
	name: string;
}

/** Builds the bootstrap input from a legacy workspace's config files. */
export function buildImportInput(request: ImportConfigRequest): InitInput {
	const profileFile = parse(
		ProfileFileSchema,
		request.documents.profile,
		"profile.yml",
	);
	const { version, ...profile } = profileFile;
	if (version !== 1) throw new ConfigError("profile.yml: expected version 1");
	const config = parse(
		ConfigSchema,
		{
			pipeline: request.documents.pipeline,
			providers: request.documents.providers,
			publishers: request.documents.publishers,
		},
		"config",
	);
	const instance = parse(
		InstanceSchema,
		{
			version: 1,
			name: request.name,
			country: profile.country,
			market: profile.market,
		},
		"instance",
	);
	return { instance, profile, config };
}

function parse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success)
		throw new ConfigError(`${label}: ${parsed.error.message}`);
	return parsed.data;
}
