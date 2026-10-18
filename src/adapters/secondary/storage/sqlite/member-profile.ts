import type Database from "better-sqlite3";
import {
	ProfileSchema,
	type Profile,
} from "../../../../core/schemas/profile.js";
import type { TableDefinition } from "./migrate.js";
import { CorruptRecordError, requireJson } from "./record.js";

/** Member profiles table. One profile per member, the admin included. */
export const memberProfileTable: TableDefinition = {
	table: "member_profiles",
	dependsOn: ["members"],
	createTable: `
CREATE TABLE member_profiles (
	member_id TEXT PRIMARY KEY REFERENCES members(id),
	profile TEXT NOT NULL
);`,
};

/** Reads a member's profile, or null when they have none. */
export async function readMemberProfile(
	database: Database.Database,
	memberId: string,
): Promise<Profile | null> {
	const row = database
		.prepare("SELECT profile FROM member_profiles WHERE member_id = ?")
		.get(memberId) as { profile: string } | undefined;
	if (row === undefined) return null;
	const document = requireJson<unknown>(
		"member_profiles",
		memberId,
		"profile",
		row.profile,
	);
	const parsed = ProfileSchema.safeParse(document);
	if (!parsed.success)
		throw new CorruptRecordError(
			"member_profiles",
			memberId,
			parsed.error.message,
		);
	return parsed.data;
}

/** Writes a member's profile, replacing the previous one. */
export async function writeMemberProfile(
	database: Database.Database,
	memberId: string,
	profile: Profile,
): Promise<void> {
	database
		.prepare(
			`INSERT INTO member_profiles (member_id, profile) VALUES (?, ?)
			ON CONFLICT(member_id) DO UPDATE SET profile = excluded.profile`,
		)
		.run(memberId, JSON.stringify(profile));
}
