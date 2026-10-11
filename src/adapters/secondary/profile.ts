import yaml from "js-yaml";
import { ConfigError } from "../../core/errors/config.js";
import { errorMessage } from "../../core/errors/message.js";
import { ProfileFileSchema, type Profile } from "../../core/schemas/index.js";

/** Parses profile.yml into the user's profile. Throws when missing or invalid. */
export function parseProfile(profileText: string | null): Profile {
	if (profileText === null) {
		throw new ConfigError("profile.yml missing — run housing-ops setup");
	}
	const parsed = ProfileFileSchema.safeParse(loadYaml(profileText));
	if (!parsed.success) {
		throw new ConfigError(
			`profile.yml: ${parsed.error.message}`,
			parsed.error,
		);
	}
	return parsed.data;
}

function loadYaml(text: string): unknown {
	try {
		return yaml.load(text);
	} catch (error) {
		throw new ConfigError(`profile.yml: ${errorMessage(error)}`, error);
	}
}

/** Parses profile.yml, returning null when it is missing or invalid. */
export function tryParseProfile(profileText: string | null): Profile | null {
	try {
		return parseProfile(profileText);
	} catch {
		return null;
	}
}
