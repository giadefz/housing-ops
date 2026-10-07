import { QueueInputSchema } from "../../../../core/schemas/requests.js";
import type { Flags } from "../argv.js";
import { fail, ok } from "../envelope.js";
import { readNumber, readString } from "./flags.js";
import type { CommandHandler } from "./types.js";

/** Queue command: parse a queue request and list one page. */
export const queueCommands: Record<string, CommandHandler> = {
	queue: async (app, args) => {
		const parsed = QueueInputSchema.safeParse(queueRequest(args.flags));
		if (!parsed.success)
			return fail({ code: "VALIDATION", message: parsed.error.message });
		return ok(await app.listQueue(parsed.data));
	},
};

function queueRequest(flags: Flags): unknown {
	return {
		status: readString(flags["status"]),
		limit: readNumber(flags["limit"]),
	};
}
