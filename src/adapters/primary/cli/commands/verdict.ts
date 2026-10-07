import type { VerdictInput } from "../../../../core/ports/application.port.js";
import type { Flags } from "../argv.js";
import { fail, ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

const USAGE =
	"usage: housing-ops verdict set <id> --tier triage|analyse --verdict <verdict> --reason <text>";

/** Verdict command: record an agent judgment on an offer. */
export const verdictCommands: Record<string, CommandHandler> = {
	verdict: async (app, args) => {
		if (args.rest[0] !== "set" || args.rest[1] === undefined)
			return fail({ code: "USAGE", message: USAGE });
		const input = readInput(args.flags);
		if (input === null) return fail({ code: "USAGE", message: USAGE });
		return ok(await app.setVerdict(args.rest[1], input));
	},
};

function readInput(flags: Flags): VerdictInput | null {
	const tier = readRequired(flags["tier"]);
	const verdict = readRequired(flags["verdict"]);
	const reason = readRequired(flags["reason"]);
	if (tier === null || verdict === null || reason === null) return null;
	const confidence = readConfidence(flags["confidence"]);
	if (confidence === "invalid") return null;
	return {
		tier,
		verdict,
		reason,
		pros: readList(flags["pros"]),
		cons: readList(flags["cons"]),
		priceAssessment: readOptional(flags["price-assessment"]),
		redFlags: readList(flags["red-flags"]),
		recommendation: readOptional(flags["recommendation"]),
		confidence: confidence === null ? undefined : confidence,
	};
}

function readRequired(flag: string | boolean | undefined): string | null {
	return typeof flag === "string" && flag.length > 0 ? flag : null;
}

function readOptional(flag: string | boolean | undefined): string | undefined {
	return typeof flag === "string" && flag.length > 0 ? flag : undefined;
}

function readList(flag: string | boolean | undefined): string[] | undefined {
	if (typeof flag !== "string") return undefined;
	const items = flag
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return items.length > 0 ? items : undefined;
}

function readConfidence(
	flag: string | boolean | undefined,
): number | null | "invalid" {
	if (flag === undefined) return null;
	if (typeof flag !== "string") return "invalid";
	const value = Number(flag);
	if (!Number.isFinite(value) || value < 0 || value > 1) return "invalid";
	return value;
}
