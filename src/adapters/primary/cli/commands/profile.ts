import { fail, ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

const USAGE =
	"usage: housing-ops profile get [path] | profile set <path> <json-value> | profile digest";

/** Profile commands: read or write single values of profile.yml, or read the digest. */
export const profileCommands: Record<string, CommandHandler> = {
	profile: async (app, args) => {
		const [subcommand, path, raw] = args.rest;
		if (subcommand === "get") return ok(app.getProfile(path));
		if (subcommand === "digest") return ok(await app.getDigest());
		if (subcommand === "set" && path !== undefined && raw !== undefined) {
			const value = parseJson(raw);
			if (value === "invalid")
				return fail({
					code: "USAGE",
					message: `${USAGE} (value must be JSON)`,
				});
			return ok(await app.setProfile(path, value));
		}
		return fail({ code: "USAGE", message: USAGE });
	},
};

function parseJson(raw: string): unknown {
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return "invalid";
	}
}
