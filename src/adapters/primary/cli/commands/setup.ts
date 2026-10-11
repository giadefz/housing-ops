import fs from "node:fs";
import { errorMessage } from "../../../../core/errors/message.js";
import {
	SetupInputSchema,
	type SetupInput,
} from "../../../../core/schemas/index.js";
import { fail, ok } from "../envelope.js";
import { readString } from "./flags.js";
import type { CommandHandler } from "./types.js";

const USAGE =
	"usage: housing-ops setup --answers <file>  (or pipe the JSON on stdin)";

/** Setup command: write the workspace from the five preformatted config documents. */
export const setupCommands: Record<string, CommandHandler> = {
	setup: (app, args) => {
		const file = readString(args.flags["answers"]);
		const source = file ?? (process.stdin.isTTY ? null : 0);
		if (source === null) return fail({ code: "USAGE", message: USAGE });
		const text = readText(source);
		if (text === null)
			return fail({
				code: "VALIDATION",
				message: `cannot read answers from ${file ?? "stdin"}`,
			});
		const parsed = parseAnswers(text);
		if (!parsed.ok)
			return fail({ code: "VALIDATION", message: parsed.error });
		return ok(app.setup(parsed.value, args.flags["force"] === true));
	},
};

function readText(source: string | number): string | null {
	try {
		return fs.readFileSync(source, "utf8");
	} catch {
		return null;
	}
}

type ParsedAnswers =
	{ ok: true; value: SetupInput } | { ok: false; error: string };

function parseAnswers(text: string): ParsedAnswers {
	const json = parseJson(text);
	if (!json.ok) return json;
	const parsed = SetupInputSchema.safeParse(json.value);
	if (!parsed.success) return { ok: false, error: parsed.error.message };
	return { ok: true, value: parsed.data };
}

function parseJson(
	text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch (error) {
		return {
			ok: false,
			error: `answers are not JSON: ${errorMessage(error)}`,
		};
	}
}
