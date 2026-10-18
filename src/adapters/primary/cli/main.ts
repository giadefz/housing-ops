#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { createApplication } from "../../../bundled.js";
import { resolveRoot } from "../../secondary/workspace.js";
import { fail } from "./envelope.js";
import { toFailure } from "./failures.js";
import { finish, runCli } from "./run.js";

async function main(): Promise<void> {
	try {
		await runCli(await createApplication(resolveRoot()), process.argv);
	} catch (error) {
		finish(fail(toFailure(error)));
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
