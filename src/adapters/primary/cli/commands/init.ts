import fs from "node:fs";
import { errorMessage } from "../../../../core/errors/message.js";
import { InitInputSchema } from "../../../../core/schemas/init.js";
import type { InitInput } from "../../../../core/schemas/init.js";
import { fail, ok } from "../envelope.js";
import { readString } from "./flags.js";
import type { CommandHandler } from "./types.js";

const USAGE =
	"usage: housing-ops init --file <file>  (or pipe the JSON on stdin)";

/** Init command: write the instance file, shared config, and admin profile. */
export const initCommands: Record<string, CommandHandler> = {
	init: async (app, args) => {
		const file = readString(args.flags["file"]);
		const source = file ?? (process.stdin.isTTY ? null : 0);
		if (source === null) return fail({ code: "USAGE", message: USAGE });
		const text = readText(source);
		if (text === null)
			return fail({
				code: "VALIDATION",
				message: `cannot read input from ${file ?? "stdin"}`,
			});
		const parsed = parseInput(text);
		if (!parsed.ok)
			return fail({ code: "VALIDATION", message: parsed.error });
		return ok(
			await app.init({
				input: parsed.value,
				force: args.flags["force"] === true,
			}),
		);
	},
};

function readText(source: string | number): string | null {
	try {
		return fs.readFileSync(source, "utf8");
	} catch {
		return null;
	}
}

type ParsedInput =
	{ ok: true; value: InitInput } | { ok: false; error: string };

function parseInput(text: string): ParsedInput {
	const json = parseJson(text);
	if (!json.ok) return json;
	const parsed = InitInputSchema.safeParse(json.value);
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
			error: `input is not JSON: ${errorMessage(error)}`,
		};
	}
}
