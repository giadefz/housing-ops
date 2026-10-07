import { fail, ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

const USAGE =
	"usage: housing-ops interact <id> --action viewed|favorited|rejected|viewing-requested|visited|shared [--reason <text>]";

/** Interact command: record a user reaction on an offer. */
export const interactCommands: Record<string, CommandHandler> = {
	interact: async (app, args) => {
		const id = args.rest[0];
		const action = args.flags["action"];
		if (
			id === undefined ||
			typeof action !== "string" ||
			action.length === 0
		)
			return fail({ code: "USAGE", message: USAGE });
		return ok(
			await app.interact(id, {
				action,
				reason: readReason(args.flags["reason"]),
			}),
		);
	},
};

function readReason(flag: string | boolean | undefined): string | undefined {
	return typeof flag === "string" && flag.length > 0 ? flag : undefined;
}
