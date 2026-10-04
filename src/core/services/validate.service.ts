import yaml from "js-yaml";
import {
	CONFIG_FILES,
	ConfigSchemas,
	ExtensionApprovalSchema,
	ExtensionsFileSchema,
	type ConfigFile,
	type ExtensionApproval,
} from "../config-schema.js";
import { errorMessage } from "../errors.js";
import { API_VERSION } from "../version.js";
import type { Finding, ValidationReport } from "../ports/application.port.js";

/** Everything validation reads: raw config texts, current file hashes, database presence. */
export interface WorkspaceInput {
	configTexts: Record<ConfigFile, string | null>;
	currentHashes: Record<string, string | null>;
	databaseExists: boolean;
}

const SETUP_HINT = "run housing-ops setup";

/** Checks a workspace snapshot for config, approval, database, and version problems. Pure: reads nothing, every input arrives in WorkspaceInput. */
export function validateWorkspace(input: WorkspaceInput): ValidationReport {
	return {
		findings: [
			...validateConfigs(input.configTexts),
			...verifyApprovals(
				input.configTexts["extensions.yml"],
				input.currentHashes,
			),
			checkDatabase(input.databaseExists),
			checkApiVersion(),
		],
	};
}

function validateConfigs(texts: Record<ConfigFile, string | null>): Finding[] {
	return CONFIG_FILES.map((file) => validateConfig(file, texts[file]));
}

function validateConfig(file: ConfigFile, text: string | null): Finding {
	if (text === null) return missingConfig(file);
	const parsed = parseYaml(text);
	if (!parsed.ok) return invalidConfig(file, parsed.error);
	const checked = ConfigSchemas[file].safeParse(parsed.data);
	if (!checked.success) return invalidConfig(file, checked.error.message);
	return { name: `config.${file}`, ok: true };
}

function missingConfig(file: ConfigFile): Finding {
	return {
		name: `config.${file}`,
		ok: false,
		detail: `missing — ${SETUP_HINT}`,
	};
}

function invalidConfig(file: ConfigFile, reason: string): Finding {
	return { name: `config.${file}`, ok: false, detail: `invalid: ${reason}` };
}

function parseYaml(
	text: string,
): { ok: true; data: unknown } | { ok: false; error: string } {
	try {
		const document: unknown = yaml.load(text);
		return { ok: true, data: document };
	} catch (error) {
		return { ok: false, error: errorMessage(error) };
	}
}

function verifyApprovals(
	extensionsText: string | null,
	currentHashes: Record<string, string | null>,
): Finding[] {
	if (extensionsText === null) return [nothingApproved()];
	const parsed = parseYaml(extensionsText);
	if (!parsed.ok) return [invalidExtensionsFile()];
	const checked = ExtensionsFileSchema.safeParse(parsed.data);
	if (!checked.success) return [invalidExtensionsFile()];
	const approvals = checked.data.approvals ?? [];
	if (approvals.length === 0) return [nothingApproved()];
	return approvals.map((candidate, index) =>
		verifyApproval({ candidate, index, currentHashes }),
	);
}

function nothingApproved(): Finding {
	return { name: "extensions", ok: true, detail: "no approved extensions" };
}

function invalidExtensionsFile(): Finding {
	return {
		name: "extensions",
		ok: false,
		detail: "invalid extensions file — see config.extensions.yml finding",
	};
}

/** The three values needed to verify one approval. */
interface ApprovalCheck {
	candidate: unknown;
	index: number;
	currentHashes: Record<string, string | null>;
}

function verifyApproval(check: ApprovalCheck): Finding {
	const parsed = ExtensionApprovalSchema.safeParse(check.candidate);
	if (!parsed.success)
		return invalidApproval(check.index, parsed.error.message);
	return verifyApprovalFile(parsed.data, check.currentHashes);
}

function invalidApproval(index: number, reason: string): Finding {
	return {
		name: `extension[${index}]`,
		ok: false,
		detail: `invalid approval: ${reason}`,
	};
}

function verifyApprovalFile(
	approval: ExtensionApproval,
	currentHashes: Record<string, string | null>,
): Finding {
	const hash = currentHashes[approval.path];
	if (hash === undefined || hash === null) {
		return {
			name: `extension.${approval.id}`,
			ok: false,
			detail: `approved file missing: ${approval.path}`,
		};
	}
	if (hash !== approval.sha256) {
		return {
			name: `extension.${approval.id}`,
			ok: false,
			detail: "file changed since approval — re-approve to load it",
		};
	}
	return { name: `extension.${approval.id}`, ok: true };
}

function checkDatabase(databaseExists: boolean): Finding {
	if (databaseExists)
		return { name: "db", ok: true, detail: "data/housing.db present" };
	return { name: "db", ok: false, detail: `not initialized — ${SETUP_HINT}` };
}

function checkApiVersion(): Finding {
	return { name: "api", ok: true, detail: `api ${API_VERSION}` };
}
