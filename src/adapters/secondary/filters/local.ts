import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import yaml from "js-yaml";
import { ConfigError } from "../../../core/errors/config.js";
import { errorMessage } from "../../../core/errors/message.js";
import type { FilterPort } from "../../../core/ports/filter.port.js";
import {
	ExtensionApprovalSchema,
	ExtensionsFileSchema,
} from "../../../core/schemas/index.js";

/** Loads the approved local filter modules. A missing, changed, or unapproved file is refused. */
export async function loadLocalFilters(
	root: string,
	extensionsText: string | null,
): Promise<Map<string, FilterPort>> {
	const filters = new Map<string, FilterPort>();
	for (const approved of approvedFilters(extensionsText)) {
		const filePath = path.resolve(root, approved.file);
		if (!matchesApproval(filePath, approved.sha256)) continue;
		filters.set(approved.id, await importFilter(filePath, approved.id));
	}
	return filters;
}

interface ApprovedFilter {
	id: string;
	file: string;
	sha256: string;
}

function approvedFilters(extensionsText: string | null): ApprovedFilter[] {
	if (extensionsText === null) return [];
	const parsed = ExtensionsFileSchema.safeParse(loadYaml(extensionsText));
	if (!parsed.success) {
		throw new ConfigError(
			`extensions.yml: ${parsed.error.message}`,
			parsed.error,
		);
	}
	const approvals = parsed.data.approvals ?? [];
	return approvals.flatMap((candidate) => filterApproval(candidate));
}

function filterApproval(candidate: unknown): ApprovedFilter[] {
	const approval = ExtensionApprovalSchema.safeParse(candidate);
	if (!approval.success || approval.data.kind !== "filter") return [];
	return [
		{
			id: approval.data.id,
			file: approval.data.path,
			sha256: approval.data.sha256,
		},
	];
}

function matchesApproval(filePath: string, sha256: string): boolean {
	if (!fs.existsSync(filePath)) return false;
	const actual = crypto
		.createHash("sha256")
		.update(fs.readFileSync(filePath))
		.digest("hex");
	return actual === sha256;
}

async function importFilter(filePath: string, id: string): Promise<FilterPort> {
	const module = (await import(pathToFileURL(filePath).href)) as {
		default?: unknown;
	};
	if (!isFilterPort(module.default)) {
		throw new ConfigError(
			`filter "${id}" does not export a valid FilterPort`,
		);
	}
	return module.default;
}

function isFilterPort(value: unknown): value is FilterPort {
	if (typeof value !== "object" || value === null) return false;
	return (
		"id" in value &&
		typeof value.id === "string" &&
		"evaluate" in value &&
		typeof value.evaluate === "function"
	);
}

function loadYaml(text: string): unknown {
	try {
		return yaml.load(text);
	} catch (error) {
		throw new ConfigError(`extensions.yml: ${errorMessage(error)}`, error);
	}
}
