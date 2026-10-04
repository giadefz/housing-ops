import { fail, ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

/** Provider commands: trial-run one provider on a small sample. */
export const providerCommands: Record<string, CommandHandler> = {
	provider: async (app, args) => {
		const [subcommand, id] = [args.rest[0], args.rest[1]];
		if (subcommand !== "test" || id === undefined) {
			return fail({
				code: "USAGE",
				message: "usage: housing-ops provider test <id>",
			});
		}
		return ok(await app.testProvider(id));
	},
};
