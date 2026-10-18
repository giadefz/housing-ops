import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { writeInstance } from "../src/adapters/secondary/instance.js";
import { findOfferByListing } from "../src/adapters/secondary/storage/sqlite/offer.js";
import {
	closeStore,
	createSqliteStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";
import type { Config } from "../src/core/schemas/config.js";
import type { Instance } from "../src/core/schemas/instance.js";
import type { Profile } from "../src/core/schemas/profile.js";
import { createDefaultApplication } from "../src/defaults.js";

let roots: string[] = [];
afterEach(() => {
	for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
	roots = [];
});

const MEMBER = DEFAULT_MEMBER_ID;

async function feedState(
	database: Database.Database,
	listingId: string,
): Promise<string | undefined> {
	const offer = await findOfferByListing(database, "fake", listingId);
	if (offer === null) return undefined;
	const row = database
		.prepare("SELECT state FROM feed WHERE member_id = ? AND offer_id = ?")
		.get(MEMBER, offer.id) as { state: string } | undefined;
	return row?.state;
}

const listings = [
	{
		listing_id: "cheap",
		url: "https://example.invalid/cheap",
		market: "rent",
		price: { amount: 2000, currency: "EUR", period: "month" },
		address_text: "1 Main Street, Dublin 8",
		extra: { ber: "B", eircode: "D08X1" },
	},
	{
		listing_id: "pricey",
		url: "https://example.invalid/pricey",
		market: "rent",
		price: { amount: 3000, currency: "EUR", period: "month" },
		address_text: "2 Main Street, Dublin 8",
		extra: { ber: "B", eircode: "D08X2" },
	},
	{ listing_id: "bad" },
];

function instanceFixture(): Instance {
	return {
		version: 1,
		name: "Home",
		country: "ie",
		market: "rent",
		interfaces: ["cli"],
	};
}

function profileFixture(): Profile {
	return {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: false,
		recheckHours: 48,
	};
}

function configFixture(): Config {
	return {
		pipeline: {
			version: 1,
			filters: [{ id: "budget", enabled: true, missing: "fail" }],
		},
		providers: {
			version: 1,
			providers: [
				{
					id: "fake",
					type: "process",
					country: "ie",
					markets: ["rent"],
					enabled: true,
					command: "node",
					args: [
						"-e",
						"process.stdout.write(process.env.PAYLOAD ?? '')",
					],
					env: { PAYLOAD: JSON.stringify(listings) },
					output: "json",
				},
			],
		},
		publishers: { version: 1, publishers: [] },
	};
}

interface Workspace {
	root: string;
	database: Database.Database;
}

async function workspace(): Promise<Workspace> {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	roots.push(root);
	fs.mkdirSync(path.join(root, "data"), { recursive: true });
	writeInstance(root, instanceFixture());
	const database = openStore(path.join(root, "data", "housing.db"));
	const store = createSqliteStore(database);
	await store.writeConfig(configFixture());
	await store.writeMemberProfile(MEMBER, profileFixture());
	closeStore(database);
	return { root, database: openStore(path.join(root, "data", "housing.db")) };
}

describe("end to end", () => {
	it("validates, scans a process provider, filters, stores, and reads back", async () => {
		const { root, database } = await workspace();
		try {
			const app = await createDefaultApplication(root);

			const report = app.validateWorkspace();
			expect(report.findings.every((finding) => finding.ok)).toBe(true);

			expect(app.listProviders().map((provider) => provider.id)).toEqual([
				"fake",
			]);
			expect(app.listFilters()).toEqual([
				{
					id: "budget",
					enabled: true,
					missing: "fail",
					available: true,
				},
			]);

			const scan = await app.scan({ memberId: MEMBER });
			expect(scan).toEqual({ fetched: 3, stored: 2, deadLettered: 1 });

			expect(await feedState(database, "cheap")).toBe("accepted");
			expect(await feedState(database, "pricey")).toBeUndefined();
			const decisions = database.prepare("SELECT * FROM decisions").all();
			expect(decisions).toEqual([]);

			const dead: unknown[] = database
				.prepare("SELECT * FROM dead_letter")
				.all();
			expect(dead).toHaveLength(1);
			const verdicts: unknown[] = database
				.prepare(
					"SELECT filter_id, outcome FROM verdicts ORDER BY outcome",
				)
				.all();
			expect(verdicts).toEqual([
				{ filter_id: "budget", outcome: "fail" },
				{ filter_id: "budget", outcome: "pass" },
			]);

			expect(await app.checkFilter("budget")).toMatchObject({
				evaluated: 2,
				pass: 1,
				fail: 1,
				skip: 0,
			});
		} finally {
			closeStore(database);
		}
	});
});
