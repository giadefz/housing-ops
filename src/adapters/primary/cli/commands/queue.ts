import { fail, ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

const DEFAULT_STATUS = "pending";
const DEFAULT_LIMIT = 20;

const USAGE = "usage: housing-ops queue [--status status] [--limit n]";

/** Queue command: list one page of offers by status. */
export const queueCommands: Record<string, CommandHandler> = {
	queue: async (app, args) => {
		const status = args.flags["status"];
		if (status !== undefined && typeof status !== "string")
			return fail({ code: "USAGE", message: USAGE });
		const limit = readLimit(args.flags["limit"]);
		if (limit === null) return fail({ code: "USAGE", message: USAGE });
		return ok(
			await app.listQueue(
				typeof status === "string" ? status : DEFAULT_STATUS,
				limit,
			),
		);
	},
};

function readLimit(flag: string | boolean | undefined): number | null {
	if (flag === undefined) return DEFAULT_LIMIT;
	if (typeof flag !== "string") return null;
	const parsed = Number.parseInt(flag, 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
