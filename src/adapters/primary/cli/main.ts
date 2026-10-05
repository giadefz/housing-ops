#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { createDefaultApplication } from "../../../defaults.js";
import { resolveRoot } from "../../secondary/workspace.js";
import { runCli } from "./run.js";

async function main(): Promise<void> {
	await runCli(await createDefaultApplication(resolveRoot()), process.argv);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
