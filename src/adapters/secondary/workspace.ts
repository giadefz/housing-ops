import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import {
	CONFIG_FILES,
	ExtensionApprovalSchema,
	ExtensionsFileSchema,
} from "../../core/schemas/index.js";
import type { ConfigFile } from "../../core/schemas/index.js";
import type { Profile } from "../../core/schemas/profile.js";
import { WorkspaceExistsError } from "../../core/errors/setup.js";
import type { StoreDescription } from "../../core/ports/store.port.js";
import type { WorkspacePlan } from "../../core/services/setup.service.js";
import type { WorkspaceInput } from "../../core/services/validate.service.js";

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

/** Reads every file validation needs and pairs it with the store's self-description. */
export function readWorkspace(request: WorkspaceReadRequest): WorkspaceInput {
	const { root, store, expectedSchemaVersion } = request;
	const extensionsText = readText(configPath(root, "extensions.yml"));
	return {
		configTexts: readConfigs(root),
		currentHashes: readCurrentHashes(root, extensionsText),
		store,
		expectedSchemaVersion,
	};
}

function configPath(root: string, file: ConfigFile): string {
	return path.join(root, "config", file);
}

/** Writes profile.yml: the validated profile plus its version tag. */
export function writeProfile(root: string, profile: Profile): void {
	fs.writeFileSync(
		configPath(root, "profile.yml"),
		yaml.dump({ ...profile, version: 1 }),
		"utf8",
	);
}

/** Writes the five config documents under `config/`. Refuses an existing profile unless forced. */
export function writeWorkspace(
	root: string,
	plan: WorkspacePlan,
	force = false,
): void {
	if (!force && fs.existsSync(configPath(root, "profile.yml"))) {
		throw new WorkspaceExistsError(root);
	}
	fs.mkdirSync(path.join(root, "config"), { recursive: true });
	for (const file of CONFIG_FILES) {
		fs.writeFileSync(configPath(root, file), yaml.dump(plan[file]), "utf8");
	}
}

function readConfigs(root: string): Record<ConfigFile, string | null> {
	return {
		"profile.yml": readText(configPath(root, "profile.yml")),
		"pipeline.yml": readText(configPath(root, "pipeline.yml")),
		"providers.yml": readText(configPath(root, "providers.yml")),
		"publishers.yml": readText(configPath(root, "publishers.yml")),
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
