import { fail, ok } from "../envelope.js";
import { CLI_MEMBER_ID } from "../identity.js";
import type { CommandHandler } from "./types.js";

/** Feed commands: read its size, fill it from the pool, or clear it. */
export const feedCommands: Record<string, CommandHandler> = {
	feed: async (app, args) => {
		const subcommand = args.rest[0];
		if (subcommand === "status")
			return ok(await app.getFeedStatus(memberQuery()));
		if (subcommand === "fill") return ok(await app.fillFeed(memberQuery()));
		if (subcommand === "empty")
			return ok(await app.emptyFeed(memberQuery()));
		return fail({
			code: "USAGE",
			message: "usage: housing-ops feed <status|fill|empty>",
		});
	},
};

function memberQuery(): { memberId: string } {
	return { memberId: CLI_MEMBER_ID };
}
