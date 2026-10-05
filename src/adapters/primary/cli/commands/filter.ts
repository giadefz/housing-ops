import { fail, ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

/** Filter commands: list the configured filter stages. */
export const filterCommands: Record<string, CommandHandler> = {
	filter: async (app, args) => {
		if (args.rest[0] === "list") return ok(app.listFilters());
		return fail({
			code: "USAGE",
			message: "usage: housing-ops filter list",
		});
	},
};
