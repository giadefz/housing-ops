import {
	InvalidProfileValueError,
	ProfilePathError,
} from "../errors/profile.js";
import { ProfileSchema, type Profile } from "../schemas/profile.js";

/** Reads a dotted path from the profile; no path reads the whole profile. */
export function readProfileValue(profile: Profile, path?: string): unknown {
	if (path === undefined || path.length === 0) return profile;
	return readAtPath(profile, segments(path), path);
}

/** Returns a new profile with the dotted path set to the JSON value, validated. */
export function setProfileValue(
	profile: Profile,
	path: string,
	value: unknown,
): Profile {
	if (path.length === 0) throw new ProfilePathError(path);
	const updated = setAtPath(
		profile as Record<string, unknown>,
		segments(path),
		value,
	);
	const parsed = ProfileSchema.safeParse(updated);
	if (!parsed.success)
		throw new InvalidProfileValueError(parsed.error.message);
	return parsed.data;
}

function segments(path: string): string[] {
	return path.split(".").filter((segment) => segment.length > 0);
}

function readAtPath(source: unknown, parts: string[], path: string): unknown {
	let current: unknown = source;
	for (const part of parts) {
		if (
			typeof current !== "object" ||
			current === null ||
			!(part in current)
		) {
			throw new ProfilePathError(path);
		}
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function setAtPath(
	source: Record<string, unknown>,
	parts: string[],
	value: unknown,
): Record<string, unknown> {
	const [head, ...rest] = parts;
	if (head === undefined) return source;
	if (rest.length === 0) return { ...source, [head]: value };
	const child = source[head];
	const branch =
		typeof child === "object" && child !== null && !Array.isArray(child)
			? (child as Record<string, unknown>)
			: {};
	return { ...source, [head]: setAtPath(branch, rest, value) };
}
