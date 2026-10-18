/** Member roles. Single source for the role union. */
export const MEMBER_ROLES = ["admin", "member"] as const;

/** What a member may do: own the world, or just search within it. */
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** One person attached to the instance. */
export interface Member {
	id: string;
	name: string;
	role: MemberRole;
	createdAt: string;
}

/** The built-in member the local CLI acts as. */
export const DEFAULT_MEMBER_ID = "local";

/** Builds the built-in member record. */
export function defaultMember(createdAt: string): Member {
	return { id: DEFAULT_MEMBER_ID, name: "Local", role: "admin", createdAt };
}
