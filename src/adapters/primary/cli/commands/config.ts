import fs from "node:fs";
import { errorMessage } from "../../../../core/errors/message.js";
import type { ApplicationPort } from "../../../../core/ports/application.port.js";
import { ConfigSchema } from "../../../../core/schemas/config.js";
import type { Config } from "../../../../core/schemas/config.js";
import { fail, ok } from "../envelope.js";
import { readString } from "./flags.js";
import type { CommandHandler } from "./types.js";

const USAGE =
	"usage: housing-ops config get | config set <file> | config import [--name <name>] [--force]";

/** Config commands: read, replace, or import the shared config document. */
export const configCommands: Record<string, CommandHandler> = {
	config: async (app, args) => {
		const [subcommand, file] = [args.rest[0], args.rest[1]];
		if (subcommand === "get") return ok(await app.getConfig());
		if (subcommand === "set") return setConfig(app, file);
		if (subcommand === "import")
			return ok(
				await app.importConfig({
					name: readString(args.flags["name"]) ?? "Home",
					force: args.flags["force"] === true,
				}),
			);
		return fail({ code: "USAGE", message: USAGE });
	},
};

async function setConfig(app: ApplicationPort, file: string | undefined) {
	const source = file ?? (process.stdin.isTTY ? null : 0);
	if (source === null) return fail({ code: "USAGE", message: USAGE });
	const text = readText(source);
	if (text === null)
		return fail({
			code: "VALIDATION",
			message: `cannot read config from ${file ?? "stdin"}`,
		});
	const parsed = parseConfig(text);
	if (!parsed.ok) return fail({ code: "VALIDATION", message: parsed.error });
	return ok(await app.setConfig(parsed.value));
}

function readText(source: string | number): string | null {
	try {
		return fs.readFileSync(source, "utf8");
	} catch {
		return null;
	}
}

type ParsedConfig = { ok: true; value: Config } | { ok: false; error: string };

function parseConfig(text: string): ParsedConfig {
	const json = parseJson(text);
	if (!json.ok) return json;
	const parsed = ConfigSchema.safeParse(json.value);
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
			error: `config is not JSON: ${errorMessage(error)}`,
		};
	}
}
