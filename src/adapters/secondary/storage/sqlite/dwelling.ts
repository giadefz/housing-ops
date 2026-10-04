import type Database from "better-sqlite3";
import { z } from "zod";
import { LAYOUT_TYPES } from "../../../../core/domain/dwelling.js";
import type {
	Address,
	Attributes,
	Dwelling,
	Rooms,
	Size,
} from "../../../../core/domain/dwelling.js";
import type { TableDefinition } from "./migrate.js";
import {
	CorruptRowError,
	parseEnum,
	parseJson,
	requireJson,
	rowId,
} from "./row.js";

/** Dwellings table. One row per known place, keyed by normalized address. */
export const dwellingTable: TableDefinition = {
	table: "dwellings",
	dependsOn: [],
	createTable: `
CREATE TABLE dwellings (
	id TEXT PRIMARY KEY,
	address_key TEXT NOT NULL UNIQUE,
	address TEXT NOT NULL,
	size TEXT,
	rooms TEXT,
	layout TEXT NOT NULL,
	year_built INTEGER,
	floor INTEGER,
	floors_total INTEGER,
	attributes TEXT NOT NULL
);`,
};

const DwellingRowSchema = z.object({
	id: z.string(),
	address_key: z.string(),
	address: z.string(),
	size: z.string().nullable(),
	rooms: z.string().nullable(),
	layout: z.string(),
	year_built: z.number().nullable(),
	floor: z.number().nullable(),
	floors_total: z.number().nullable(),
	attributes: z.string(),
});

/** Dwellings row DTO. JSON columns are text, absent values are null. */
export type DwellingRow = z.infer<typeof DwellingRowSchema>;

export function toDwellingRow(dwelling: Dwelling): DwellingRow {
	return {
		id: dwelling.id,
		address_key: dwelling.addressKey,
		address: JSON.stringify(dwelling.address),
		size:
			dwelling.size === undefined ? null : JSON.stringify(dwelling.size),
		rooms:
			dwelling.rooms === undefined
				? null
				: JSON.stringify(dwelling.rooms),
		layout: dwelling.layout,
		year_built: dwelling.yearBuilt ?? null,
		floor: dwelling.floor ?? null,
		floors_total: dwelling.floorsTotal ?? null,
		attributes: JSON.stringify(dwelling.attributes),
	};
}

export function fromDwellingRow(row: unknown): Dwelling {
	const parsed = DwellingRowSchema.safeParse(row);
	if (!parsed.success)
		throw new CorruptRowError(
			"dwellings",
			rowId(row),
			parsed.error.message,
		);
	const valid = parsed.data;
	return {
		id: valid.id,
		addressKey: valid.address_key,
		address: requireJson<Address>(
			"dwellings",
			valid.id,
			"address",
			valid.address,
		),
		size: parseJson<Size>("dwellings", valid.id, "size", valid.size),
		rooms: parseJson<Rooms>("dwellings", valid.id, "rooms", valid.rooms),
		layout: parseEnum(
			"dwellings",
			valid.id,
			"layout",
			valid.layout,
			LAYOUT_TYPES,
		),
		yearBuilt: valid.year_built ?? undefined,
		floor: valid.floor ?? undefined,
		floorsTotal: valid.floors_total ?? undefined,
		attributes: requireJson<Attributes>(
			"dwellings",
			valid.id,
			"attributes",
			valid.attributes,
		),
	};
}

/** Persists a dwelling, replacing on id conflict. */
export async function saveDwelling(
	database: Database.Database,
	dwelling: Dwelling,
): Promise<void> {
	const row = toDwellingRow(dwelling);
	database
		.prepare(
			`INSERT INTO dwellings (id, address_key, address, size, rooms, layout, year_built, floor, floors_total, attributes)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET address_key = excluded.address_key, address = excluded.address,
			size = excluded.size, rooms = excluded.rooms, layout = excluded.layout, year_built = excluded.year_built,
			floor = excluded.floor, floors_total = excluded.floors_total, attributes = excluded.attributes`,
		)
		.run(
			row.id,
			row.address_key,
			row.address,
			row.size,
			row.rooms,
			row.layout,
			row.year_built,
			row.floor,
			row.floors_total,
			row.attributes,
		);
}

/** Finds a dwelling by normalized address key. Null when unknown. */
export async function findDwellingByAddressKey(
	database: Database.Database,
	addressKey: string,
): Promise<Dwelling | null> {
	const row: unknown = database
		.prepare("SELECT * FROM dwellings WHERE address_key = ?")
		.get(addressKey);
	if (row === undefined) return null;
	return fromDwellingRow(row);
}
