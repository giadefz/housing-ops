import { errorMessage } from "../../../../core/errors.js";

/** A stored row that cannot be parsed. */
export class CorruptRowError extends Error {
	constructor(table: string, id: string, reason: string) {
		super(`corrupt ${table} row ${id}: ${reason}`);
		this.name = "CorruptRowError";
	}
}

export function rowId(row: unknown): string {
	if (
		typeof row === "object" &&
		row !== null &&
		"id" in row &&
		typeof row.id === "string"
	) {
		return row.id;
	}
	return "unknown";
}

/** Parses a JSON column. Null stays undefined; malformed text throws. */
export function parseJson<T>(
	table: string,
	id: string,
	column: string,
	text: string | null,
): T | undefined {
	if (text === null) return undefined;
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new CorruptRowError(
			table,
			id,
			`${column}: ${errorMessage(error)}`,
		);
	}
	return parsed as T;
}

/** Parses a required JSON column. Null or malformed text throws. */
export function requireJson<T>(
	table: string,
	id: string,
	column: string,
	text: string | null,
): T {
	const parsed = parseJson<T>(table, id, column, text);
	if (parsed === undefined)
		throw new CorruptRowError(table, id, `${column}: missing`);
	return parsed;
}

/** Reads an enum column against its member list. Unknown values throw. */
export function parseEnum<T extends string>(
	table: string,
	id: string,
	column: string,
	value: string,
	members: readonly T[],
): T {
	for (const member of members) {
		if (member === value) return member;
	}
	throw new CorruptRowError(table, id, `${column}: unknown value ${value}`);
}
