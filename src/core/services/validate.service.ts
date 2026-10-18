import yaml from "js-yaml";
import { DEFAULT_MEMBER_ID } from "../domain/member.js";
import { errorMessage } from "../errors/message.js";
import type { Finding, ValidationReport } from "../ports/application.port.js";
import type { StoreDescription } from "../ports/store.port.js";
import type { Config } from "../schemas/config.js";
import {
	ExtensionApprovalSchema,
	ExtensionsFileSchema,
	type ExtensionApproval,
} from "../schemas/index.js";
import { InstanceSchema, type Instance } from "../schemas/instance.js";
import type { Profile } from "../schemas/profile.js";
import { API_VERSION } from "../version.js";

/** Everything validation reads: the instance file, the store config and profiles, and the extension manifest. */
export interface MemberProfile {
	memberId: string;
	profile: Profile | null;
}

export interface WorkspaceInput {
	instanceText: string | null;
	config: Config | null;
	profile: Profile | null;
	configError?: string;
	profileError?: string;
	members: MemberProfile[];
	extensionsText: string | null;
	currentHashes: Record<string, string | null>;
	store: StoreDescription;
	expectedSchemaVersion: number;
}

const INIT_HINT = "run housing-ops init";

/** Checks an instance snapshot for config, approval, database, schema, and version problems. Pure. */
export function validateWorkspace(input: WorkspaceInput): ValidationReport {
	return {
		findings: [
			validateInstance(input.instanceText),
			validateStoreConfig(input.config, input.configError),
			validateStoreProfile(input.profile, input.profileError),
			...verifyApprovals(input.extensionsText, input.currentHashes),
			...checkIdentity(input),
			...validateMemberProfiles(input),
			checkDatabase(input.store),
			checkSchemaVersion(input),
			checkApiVersion(),
		],
	};
}

function validateInstance(text: string | null): Finding {
	if (text === null) return missing("config.instance");
	const parsed = parseYaml(text);
	if (!parsed.ok) return invalid("config.instance", parsed.error);
	const checked = InstanceSchema.safeParse(parsed.data);
	if (!checked.success)
		return invalid("config.instance", checked.error.message);
	return { name: "config.instance", ok: true };
}

function validateStoreConfig(
	config: Config | null,
	error: string | undefined,
): Finding {
	if (error !== undefined)
		return { name: "config.store", ok: false, detail: `corrupt: ${error}` };
	if (config === null) return missing("config.store");
	return { name: "config.store", ok: true };
}

function validateStoreProfile(
	profile: Profile | null,
	error: string | undefined,
): Finding {
	if (error !== undefined)
		return { name: "profile", ok: false, detail: `corrupt: ${error}` };
	if (profile === null) return missing("profile");
	return { name: "profile", ok: true };
}

function missing(name: string): Finding {
	return { name, ok: false, detail: `missing — ${INIT_HINT}` };
}

function invalid(name: string, reason: string): Finding {
	return { name, ok: false, detail: `invalid: ${reason}` };
}

function checkIdentity(input: WorkspaceInput): Finding[] {
	const instance = parseInstanceValue(input.instanceText);
	if (instance === null || input.profile === null) return [];
	return [
		identityFinding(
			"identity",
			instance,
			input.profile,
			"the admin profile",
		),
	];
}

function validateMemberProfiles(input: WorkspaceInput): Finding[] {
	const instance = parseInstanceValue(input.instanceText);
	return input.members
		.filter((member) => member.memberId !== DEFAULT_MEMBER_ID)
		.flatMap((member) => memberFindings(member, instance));
}

function memberFindings(
	member: MemberProfile,
	instance: Instance | null,
): Finding[] {
	if (member.profile === null)
		return [
			{
				name: `profile.${member.memberId}`,
				ok: false,
				detail: `missing — ${INIT_HINT}`,
			},
		];
	const findings: Finding[] = [
		{ name: `profile.${member.memberId}`, ok: true },
	];
	if (instance !== null)
		findings.push(
			identityFinding(
				`identity.${member.memberId}`,
				instance,
				member.profile,
				"the profile",
			),
		);
	return findings;
}

function identityFinding(
	name: string,
	instance: Instance,
	profile: Profile,
	label: string,
): Finding {
	const mismatches: string[] = [];
	if (instance.country !== profile.country) mismatches.push("country");
	if (instance.market !== profile.market) mismatches.push("market");
	if (mismatches.length === 0) return { name, ok: true };
	return {
		name,
		ok: false,
		detail: `instance.yml and ${label} disagree on ${mismatches.join(", ")}`,
	};
}

function parseInstanceValue(text: string | null): Instance | null {
	if (text === null) return null;
	const parsed = parseYaml(text);
	if (!parsed.ok) return null;
	const checked = InstanceSchema.safeParse(parsed.data);
	return checked.success ? checked.data : null;
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

function checkDatabase(store: StoreDescription): Finding {
	if (store.schemaVersion !== null)
		return { name: "db", ok: true, detail: `${store.location} present` };
	return { name: "db", ok: false, detail: `not initialized — ${INIT_HINT}` };
}

function checkApiVersion(): Finding {
	return { name: "api", ok: true, detail: `api ${API_VERSION}` };
}

function checkSchemaVersion(input: WorkspaceInput): Finding {
	const applied = input.store.schemaVersion;
	if (applied === null) {
		return { name: "schema", ok: true, detail: "no database yet" };
	}
	if (applied === input.expectedSchemaVersion) {
		return { name: "schema", ok: true, detail: `v${applied}` };
	}
	return {
		name: "schema",
		ok: false,
		detail: `database schema v${applied} vs core v${input.expectedSchemaVersion} — ${schemaFixHint(input)}`,
	};
}

function schemaFixHint(input: WorkspaceInput): string {
	const applied = input.store.schemaVersion;
	const behind = applied !== null && applied < input.expectedSchemaVersion;
	return behind ? "open the workspace to migrate" : "update housing-ops";
}
