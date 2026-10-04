import { errorMessage } from "../../../../core/errors/message.js";

/** A stored record that cannot be parsed. */
export class CorruptRecordError extends Error {
	constructor(table: string, id: string, reason: string) {
		super(`corrupt ${table} record ${id}: ${reason}`);
		this.name = "CorruptRecordError";
	}
}

export function recordId(record: unknown): string {
	if (
		typeof record === "object" &&
		record !== null &&
		"id" in record &&
		typeof record.id === "string"
	) {
		return record.id;
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
		throw new CorruptRecordError(
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
		throw new CorruptRecordError(table, id, `${column}: missing`);
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
	throw new CorruptRecordError(
		table,
		id,
		`${column}: unknown value ${value}`,
	);
}
