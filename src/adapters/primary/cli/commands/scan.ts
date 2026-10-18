import { ok } from "../envelope.js";
import { CLI_MEMBER_ID } from "../identity.js";
import type { CommandHandler } from "./types.js";

/** Scan commands: fetch from providers, normalize, and store. */
export const scanCommands: Record<string, CommandHandler> = {
	scan: async (app, args) => {
		const providerId =
			typeof args.flags["provider"] === "string"
				? args.flags["provider"]
				: undefined;
		return ok(await app.scan({ memberId: CLI_MEMBER_ID, providerId }));
	},
};
