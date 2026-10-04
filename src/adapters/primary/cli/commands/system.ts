import { ok } from "../envelope.js";
import type { CommandHandler } from "./types.js";

/** System commands: version and workspace validation. */
export const systemCommands: Record<string, CommandHandler> = {
	version: (app) => ok(app.getVersion()),
	validate: (app) => ok(app.validateWorkspace()),
};
