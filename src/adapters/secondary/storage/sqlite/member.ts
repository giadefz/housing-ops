import type Database from "better-sqlite3";
import { z } from "zod";
import { MEMBER_ROLES } from "../../../../core/domain/member.js";
import type { Member } from "../../../../core/domain/member.js";
import type { TableDefinition } from "./migrate.js";
import { CorruptRecordError, parseEnum, recordId } from "./record.js";

/** Members table. People attached to the instance, one row per person. */
export const memberTable: TableDefinition = {
	table: "members",
	dependsOn: [],
	createTable: `
CREATE TABLE members (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	role TEXT NOT NULL,
	created_at TEXT NOT NULL
);`,
};

const MemberRecordSchema = z.object({
	id: z.string(),
	name: z.string(),
	role: z.string(),
	created_at: z.string(),
});

/** Members record DTO. */
export type MemberRecord = z.infer<typeof MemberRecordSchema>;

function toRecord(member: Member): MemberRecord {
	return {
		id: member.id,
		name: member.name,
		role: member.role,
		created_at: member.createdAt,
	};
}

function toDomain(record: unknown): Member {
	const parsed = MemberRecordSchema.safeParse(record);
	if (!parsed.success)
		throw new CorruptRecordError(
			"members",
			recordId(record),
			parsed.error.message,
		);
	const valid = parsed.data;
	return {
		id: valid.id,
		name: valid.name,
		role: parseEnum("members", valid.id, "role", valid.role, MEMBER_ROLES),
		createdAt: valid.created_at,
	};
}

/** Inserts a member, or updates its name and role. */
export async function saveMember(
	database: Database.Database,
	member: Member,
): Promise<void> {
	const record = toRecord(member);
	database
		.prepare(
			`INSERT INTO members (id, name, role, created_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role`,
		)
		.run(record.id, record.name, record.role, record.created_at);
}

/** Finds a member by id. Null when unknown. */
export function findMember(
	database: Database.Database,
	id: string,
): Member | null {
	const record: unknown = database
		.prepare("SELECT * FROM members WHERE id = ?")
		.get(id);
	return record === undefined ? null : toDomain(record);
}

/** Lists every member in creation order. */
export function listMembers(database: Database.Database): Member[] {
	const records: unknown[] = database
		.prepare("SELECT * FROM members ORDER BY created_at, id")
		.all();
	return records.map((record) => toDomain(record));
}
