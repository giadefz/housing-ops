import type { ApplicationPort } from "../../../../core/ports/application.port.js";
import {
	ProfileGetSchema,
	ProfileSetSchema,
} from "../../../../core/schemas/requests.js";
import { fail, ok } from "../envelope.js";
import { CLI_MEMBER_ID } from "../identity.js";
import { readString } from "./flags.js";
import type { CommandHandler } from "./types.js";

const USAGE =
	"usage: housing-ops profile get [path] | profile set <path> <json-value> | profile digest";

const INVALID_JSON: unique symbol = Symbol("invalid-json");

/** Profile commands: parse a get/set request or read the digest. */
export const profileCommands: Record<string, CommandHandler> = {
	profile: async (app, args) => {
		const [subcommand, path, raw] = args.rest;
		if (subcommand === "digest")
			return ok(await app.getDigest({ memberId: CLI_MEMBER_ID }));
		if (subcommand === "get") return readProfile(app, path);
		if (subcommand === "set" && raw !== undefined)
			return updateProfile(app, path, raw);
		return fail({ code: "USAGE", message: USAGE });
	},
};

async function readProfile(app: ApplicationPort, path: string | undefined) {
	const parsed = ProfileGetSchema.safeParse({ path: readString(path) });
	if (!parsed.success)
		return fail({ code: "VALIDATION", message: parsed.error.message });
	return ok(
		await app.getProfile({
			...parsed.data,
			memberId: CLI_MEMBER_ID,
		}),
	);
}

async function updateProfile(
	app: ApplicationPort,
	path: string | undefined,
	raw: string,
) {
	const value = parseJson(raw);
	if (value === INVALID_JSON)
		return fail({
			code: "VALIDATION",
			message: "value must be valid JSON",
		});
	const parsed = ProfileSetSchema.safeParse({ path, value });
	if (!parsed.success)
		return fail({ code: "VALIDATION", message: parsed.error.message });
	return ok(
		await app.setProfile({
			...parsed.data,
			memberId: CLI_MEMBER_ID,
		}),
	);
}

function parseJson(raw: string): unknown | typeof INVALID_JSON {
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return INVALID_JSON;
	}
}
