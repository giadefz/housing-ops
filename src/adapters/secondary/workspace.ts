import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import {
	ExtensionApprovalSchema,
	ExtensionsFileSchema,
} from "../../core/config-schema.js";
import type { ConfigFile } from "../../core/config-schema.js";
import type { WorkspaceInput } from "../../core/services/validate.service.js";

/** Workspace locations. The root is the repo checkout or HOUSING_OPS_ROOT. */
export function resolveRoot(): string {
	return process.env.HOUSING_OPS_ROOT ?? process.cwd();
}

/** Reads every file validation needs: raw config texts, current file hashes, database presence. */
export function readWorkspace(root: string): WorkspaceInput {
	const extensionsText = readText(configPath(root, "extensions.yml"));
	return {
		configTexts: readConfigs(root),
		currentHashes: readCurrentHashes(root, extensionsText),
		databaseExists: fs.existsSync(databasePath(root)),
	};
}

function configPath(root: string, file: ConfigFile): string {
	return path.join(root, "config", file);
}

function databasePath(root: string): string {
	return path.join(root, "data", "housing.db");
}

function readConfigs(root: string): Record<ConfigFile, string | null> {
	return {
		"profile.yml": readText(configPath(root, "profile.yml")),
		"pipeline.yml": readText(configPath(root, "pipeline.yml")),
		"providers.yml": readText(configPath(root, "providers.yml")),
		"extensions.yml": readText(configPath(root, "extensions.yml")),
	};
}

function readText(filePath: string): string | null {
	if (!fs.existsSync(filePath)) return null;
	return fs.readFileSync(filePath, "utf8");
}

function readCurrentHashes(
	root: string,
	extensionsText: string | null,
): Record<string, string | null> {
	const hashes: Record<string, string | null> = {};
	for (const approvedPath of listApprovedPaths(extensionsText)) {
		hashes[approvedPath] = hashFile(root, approvedPath);
	}
	return hashes;
}

function listApprovedPaths(extensionsText: string | null): string[] {
	if (extensionsText === null) return [];
	let document: unknown;
	try {
		document = yaml.load(extensionsText);
	} catch {
		return [];
	}
	const parsed = ExtensionsFileSchema.safeParse(document);
	if (!parsed.success || parsed.data.approvals === undefined) return [];
	return parsed.data.approvals.flatMap((candidate) => {
		const approval = ExtensionApprovalSchema.safeParse(candidate);
		return approval.success ? [approval.data.path] : [];
	});
}

function hashFile(root: string, approvedPath: string): string | null {
	const absolutePath = path.resolve(root, approvedPath);
	if (!fs.existsSync(absolutePath)) return null;
	return crypto
		.createHash("sha256")
		.update(fs.readFileSync(absolutePath))
		.digest("hex");
}
