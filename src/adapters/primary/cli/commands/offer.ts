import { fail, ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

/** Offer commands: read one offer with everything recorded against it. */
export const offerCommands: Record<string, CommandHandler> = {
	offer: async (app, args) => {
		const [subcommand, id] = [args.rest[0], args.rest[1]];
		if (subcommand !== "get" || id === undefined) {
			return fail({
				code: "USAGE",
				message: "usage: housing-ops offer get <id>",
			});
		}
		return ok(await app.getOffer(id));
	},
};
