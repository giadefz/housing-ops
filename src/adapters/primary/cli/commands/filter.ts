import { fail, ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

/** Filter commands: list the configured stages, or dry-run one filter. */
export const filterCommands: Record<string, CommandHandler> = {
	filter: async (app, args) => {
		if (args.rest[0] === "list") return ok(app.listFilters());
		if (args.rest[0] === "check" && args.rest[1] !== undefined) {
			return ok(await app.checkFilter(args.rest[1]));
		}
		return fail({
			code: "USAGE",
			message: "usage: housing-ops filter list | filter check <id>",
		});
	},
};
