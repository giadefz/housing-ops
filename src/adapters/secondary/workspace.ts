import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { StoreDescription } from "../../core/ports/store.port.js";
import {
	ExtensionApprovalSchema,
	ExtensionsFileSchema,
} from "../../core/schemas/index.js";
import { instancePath } from "./instance.js";

/** Workspace locations. The root is the repo checkout or HOUSING_OPS_ROOT. */
export function resolveRoot(): string {
	return process.env.HOUSING_OPS_ROOT ?? process.cwd();
}

/** What validation reading needs: the root, the store's self-description, and the schema version core expects. */
export interface WorkspaceReadRequest {
	root: string;
	store: StoreDescription;
	expectedSchemaVersion: number;
}

/** The files validation reads, paired with the store's self-description. */
export interface WorkspaceFiles {
	instanceText: string | null;
	extensionsText: string | null;
	currentHashes: Record<string, string | null>;
	store: StoreDescription;
	expectedSchemaVersion: number;
}

/** Reads the instance file and the CLI extension manifest. The store supplies the rest. */
export function readWorkspaceFiles(
	request: WorkspaceReadRequest,
): WorkspaceFiles {
	const { root, store, expectedSchemaVersion } = request;
	const extensionsText = readText(extensionsPath(root));
	return {
		instanceText: readText(instancePath(root)),
		extensionsText,
		currentHashes: readCurrentHashes(root, extensionsText),
		store,
		expectedSchemaVersion,
	};
}

function extensionsPath(root: string): string {
	return path.join(root, "config", "extensions.yml");
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
