import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { ConfigError } from "../../core/errors/config.js";
import type { LegacyConfigDocuments } from "../../core/services/import.service.js";

const FILES = {
	profile: "profile.yml",
	pipeline: "pipeline.yml",
	providers: "providers.yml",
	publishers: "publishers.yml",
} as const;

/** Reads and parses the legacy config files from a workspace. */
export function readLegacyConfig(root: string): LegacyConfigDocuments {
	return {
		profile: readDocument(root, FILES.profile),
		pipeline: readDocument(root, FILES.pipeline),
		providers: readDocument(root, FILES.providers),
		publishers: readDocument(root, FILES.publishers),
	};
}

function readDocument(root: string, name: string): unknown {
	const file = path.join(root, "config", name);
	if (!fs.existsSync(file)) throw new ConfigError(`missing config/${name}`);
	try {
		return yaml.load(fs.readFileSync(file, "utf8"));
	} catch (error) {
		throw new ConfigError(`cannot parse config/${name}`, error);
	}
}
