import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readWorkspaceFiles } from "../src/adapters/secondary/workspace.js";

let roots: string[] = [];
afterEach(() => {
	for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
	roots = [];
});

function emptyRoot(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	roots.push(root);
	return root;
}

function read(root: string) {
	return readWorkspaceFiles({
		root,
		store: { location: "data/housing.db", schemaVersion: null },
		expectedSchemaVersion: 1,
	});
}

function writeInstance(root: string): void {
	fs.writeFileSync(
		path.join(root, "instance.yml"),
		"version: 1\nname: Home\ncountry: ie\nmarket: rent\n",
	);
}

function writeExtensions(root: string, file: string, sha256: string): void {
	fs.mkdirSync(path.join(root, "config"), { recursive: true });
	fs.writeFileSync(
		path.join(root, "config", "extensions.yml"),
		[
			"version: 1",
			"approvals:",
			"  - id: garden",
			"    kind: filter",
			`    path: ${file}`,
			`    sha256: ${sha256}`,
			"    approved_at: 2026-10-04",
			"",
		].join("\n"),
	);
}

describe("readWorkspaceFiles", () => {
	it("returns nulls on an empty workspace", () => {
		const files = read(emptyRoot());
		expect(files.instanceText).toBeNull();
		expect(files.extensionsText).toBeNull();
		expect(files.currentHashes).toEqual({});
	});

	it("reads instance.yml as text", () => {
		const root = emptyRoot();
		writeInstance(root);
		expect(read(root).instanceText).toContain("name: Home");
	});

	it("hashes approved extension files", () => {
		const root = emptyRoot();
		const file = "filters.local/garden.ts";
		const content = "export const garden = 1;\n";
		fs.mkdirSync(path.join(root, "filters.local"), { recursive: true });
		fs.writeFileSync(path.join(root, file), content);
		const sha256 = crypto
			.createHash("sha256")
			.update(content)
			.digest("hex");
		writeExtensions(root, file, sha256);
		expect(read(root).currentHashes[file]).toBe(sha256);
	});

	it("reports null for a missing approved file", () => {
		const root = emptyRoot();
		writeExtensions(root, "filters.local/missing.ts", "abc123");
		expect(read(root).currentHashes["filters.local/missing.ts"]).toBeNull();
	});
});
