import { PublishInputSchema } from "../../../../core/schemas/requests.js";
import { fail, ok } from "../envelope.js";
import { CLI_MEMBER_ID } from "../identity.js";
import { readNumber, readString } from "./flags.js";
import type { CommandHandler } from "./types.js";

const USAGE = "usage: housing-ops publish now [--event event] [--limit n]";

/** Publish command: re-deliver a pipeline event over stored offers. */
export const publishCommands: Record<string, CommandHandler> = {
	publish: async (app, args) => {
		if (args.rest[0] !== "now")
			return fail({ code: "USAGE", message: USAGE });
		const parsed = PublishInputSchema.safeParse({
			event: readString(args.flags["event"]),
			limit: readNumber(args.flags["limit"]),
		});
		if (!parsed.success)
			return fail({ code: "VALIDATION", message: parsed.error.message });
		return ok(
			await app.publishNow({
				memberId: CLI_MEMBER_ID,
				publish: parsed.data,
			}),
		);
	},
};
