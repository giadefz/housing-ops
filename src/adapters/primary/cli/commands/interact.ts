import { InteractionInputSchema } from "../../../../core/schemas/requests.js";
import type { Flags } from "../argv.js";
import { fail, ok } from "../envelope.js";
import { readString } from "./flags.js";
import type { CommandHandler } from "./types.js";

const USAGE =
	"usage: housing-ops interact <id> --action viewed|favorited|rejected|viewing-requested|visited|shared [--reason <text>]";

/** Interact command: parse a reaction request and record it. */
export const interactCommands: Record<string, CommandHandler> = {
	interact: async (app, args) => {
		const id = args.rest[0];
		if (id === undefined) return fail({ code: "USAGE", message: USAGE });
		const parsed = InteractionInputSchema.safeParse(
			interactRequest(args.flags),
		);
		if (!parsed.success)
			return fail({ code: "VALIDATION", message: parsed.error.message });
		return ok(await app.interact(id, parsed.data));
	},
};

function interactRequest(flags: Flags): unknown {
	return {
		action: flags["action"],
		reason: readString(flags["reason"]),
	};
}
