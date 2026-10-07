import { VerdictInputSchema } from "../../../../core/schemas/requests.js";
import type { Flags } from "../argv.js";
import { fail, ok } from "../envelope.js";
import { readList, readNumber, readString } from "./flags.js";
import type { CommandHandler } from "./types.js";

const USAGE =
	"usage: housing-ops verdict set <id> --tier triage|analyse --verdict <verdict> --reason <text>";

/** Verdict command: parse a judgment request and record it. */
export const verdictCommands: Record<string, CommandHandler> = {
	verdict: async (app, args) => {
		if (args.rest[0] !== "set" || args.rest[1] === undefined)
			return fail({ code: "USAGE", message: USAGE });
		const parsed = VerdictInputSchema.safeParse(verdictRequest(args.flags));
		if (!parsed.success)
			return fail({ code: "VALIDATION", message: parsed.error.message });
		return ok(await app.setVerdict(args.rest[1], parsed.data));
	},
};

function verdictRequest(flags: Flags): unknown {
	return {
		tier: flags["tier"],
		verdict: flags["verdict"],
		reason: flags["reason"],
		pros: readList(flags["pros"]),
		cons: readList(flags["cons"]),
		priceAssessment: readString(flags["price-assessment"]),
		redFlags: readList(flags["red-flags"]),
		recommendation: readString(flags["recommendation"]),
		confidence: readNumber(flags["confidence"]),
	};
}
