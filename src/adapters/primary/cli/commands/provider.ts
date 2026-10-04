import { fail, ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

/** Provider commands: list configured providers, or trial-run one on a sample. */
export const providerCommands: Record<string, CommandHandler> = {
	provider: async (app, args) => {
		if (args.rest[0] === "list") return ok(app.listProviders());
		if (args.rest[0] === "test" && args.rest[1] !== undefined) {
			return ok(await app.testProvider(args.rest[1]));
		}
		return fail({
			code: "USAGE",
			message: "usage: housing-ops provider list | provider test <id>",
		});
	},
};
