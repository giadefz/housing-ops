import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { ConfigError } from "../../core/errors/config.js";
import { errorMessage } from "../../core/errors/message.js";
import { InstanceExistsError } from "../../core/errors/instance.js";
import { InstanceSchema, type Instance } from "../../core/schemas/instance.js";

/** The deployment identity file at the workspace root. */
export function instancePath(root: string): string {
	return path.join(root, "instance.yml");
}

/** Reads instance.yml as text, or null when it does not exist. */
export function readInstanceText(root: string): string | null {
	const file = instancePath(root);
	if (!fs.existsSync(file)) return null;
	return fs.readFileSync(file, "utf8");
}

/** Parses instance.yml into the deployment identity. */
export function parseInstance(text: string): Instance {
	const parsed = InstanceSchema.safeParse(loadYaml(text));
	if (!parsed.success)
		throw new ConfigError(`instance.yml: ${parsed.error.message}`);
	return parsed.data;
}

/** Throws when instance.yml exists and force is off. */
export function assertInstanceWritable(root: string, force: boolean): void {
	if (!force && fs.existsSync(instancePath(root)))
		throw new InstanceExistsError(root);
}

/** Writes instance.yml, refusing to replace it unless forced. */
export function writeInstance(
	root: string,
	instance: Instance,
	force = false,
): void {
	assertInstanceWritable(root, force);
	fs.writeFileSync(instancePath(root), yaml.dump(instance), "utf8");
}

function loadYaml(text: string): unknown {
	try {
		return yaml.load(text);
	} catch (error) {
		throw new ConfigError(`instance.yml: ${errorMessage(error)}`, error);
	}
}
