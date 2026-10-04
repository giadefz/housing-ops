import { describe, expect, it } from "vitest";
import {
	orderTables,
	type TableDefinition,
} from "../src/adapters/secondary/storage/sqlite/migrate.js";
import { dwellingTable } from "../src/adapters/secondary/storage/sqlite/tables/dwelling.js";
import { offerTable } from "../src/adapters/secondary/storage/sqlite/tables/offer.js";
import { offerVersionTable } from "../src/adapters/secondary/storage/sqlite/tables/offer-version.js";
import { verdictTable } from "../src/adapters/secondary/storage/sqlite/tables/verdict.js";

function tableNames(tables: TableDefinition[]): string[] {
	return tables.map((table) => table.table);
}

describe("orderTables", () => {
	it("orders dependencies before dependents", () => {
		const ordered = tableNames(
			orderTables([
				verdictTable,
				offerVersionTable,
				offerTable,
				dwellingTable,
			]),
		);
		expect(ordered.indexOf("dwellings")).toBeLessThan(
			ordered.indexOf("offers"),
		);
		expect(ordered.indexOf("offers")).toBeLessThan(
			ordered.indexOf("offer_versions"),
		);
		expect(ordered.indexOf("offers")).toBeLessThan(
			ordered.indexOf("verdicts"),
		);
	});
	it("tolerates dependencies on unknown tables", () => {
		const external: TableDefinition = {
			table: "events",
			dependsOn: ["legacy"],
			createTable: "",
		};
		expect(tableNames(orderTables([external]))).toEqual(["events"]);
	});
	it("terminates on dependency cycles", () => {
		const cyclic: TableDefinition[] = [
			{ table: "a", dependsOn: ["b"], createTable: "" },
			{ table: "b", dependsOn: ["a"], createTable: "" },
		];
		expect(tableNames(orderTables(cyclic)).sort()).toEqual(["a", "b"]);
	});
});
