import { CorruptRecordError } from "../adapters/secondary/storage/sqlite/record.js";
import type { FeedMember } from "../core/domain/feed.js";
import { DEFAULT_MEMBER_ID } from "../core/domain/member.js";
import { ProfileNotFoundError } from "../core/errors/profile.js";
import type { OfferStorePort, StoreFactory } from "../core/ports/store.port.js";
import type { Config } from "../core/schemas/config.js";
import type { Profile } from "../core/schemas/profile.js";
import type { MemberProfile } from "../core/services/validate.service.js";

/** The store facts boot needs. */
export interface StoreSnapshot {
	config: Config | null;
	profile: Profile | null;
	configError?: string;
	profileError?: string;
	members: MemberProfile[];
}

/** Opens the store for one operation and closes it afterwards. */
export async function withStore<T>(
	storeFactory: StoreFactory,
	root: string,
	use: (store: OfferStorePort) => Promise<T>,
): Promise<T> {
	const handle = storeFactory.open(root);
	try {
		return await use(handle.store);
	} finally {
		handle.close();
	}
}

/** Reads the shared config, the admin profile, and every member profile. */
export async function readStoreSnapshot(
	storeFactory: StoreFactory,
	root: string,
): Promise<StoreSnapshot> {
	const description = storeFactory.describe(root);
	if (description.schemaVersion === null)
		return { config: null, profile: null, members: [] };
	const handle = storeFactory.open(root);
	try {
		return {
			...(await readSnapshotConfig(handle.store)),
			...(await readSnapshotProfile(handle.store)),
			members: await readSnapshotMembers(handle.store),
		};
	} finally {
		handle.close();
	}
}

async function readSnapshotConfig(
	store: OfferStorePort,
): Promise<Pick<StoreSnapshot, "config" | "configError">> {
	try {
		return { config: await store.readConfig() };
	} catch (error) {
		if (error instanceof CorruptRecordError)
			return { config: null, configError: error.message };
		throw error;
	}
}

async function readSnapshotProfile(
	store: OfferStorePort,
): Promise<Pick<StoreSnapshot, "profile" | "profileError">> {
	try {
		return {
			profile: await store.readMemberProfile(DEFAULT_MEMBER_ID),
		};
	} catch (error) {
		if (error instanceof CorruptRecordError)
			return { profile: null, profileError: error.message };
		throw error;
	}
}

async function readSnapshotMembers(
	store: OfferStorePort,
): Promise<MemberProfile[]> {
	const members = await store.listMembers();
	const profiles: MemberProfile[] = [];
	for (const member of members)
		profiles.push({
			memberId: member.id,
			profile: await profileOrNull(store, member.id),
		});
	return profiles;
}

async function profileOrNull(
	store: OfferStorePort,
	memberId: string,
): Promise<Profile | null> {
	try {
		return await store.readMemberProfile(memberId);
	} catch (error) {
		if (error instanceof CorruptRecordError) return null;
		throw error;
	}
}

/** Reads a member's profile, or throws when it is missing. */
export async function memberProfile(
	store: OfferStorePort,
	memberId: string,
): Promise<Profile> {
	const profile = await store.readMemberProfile(memberId);
	if (profile === null) throw new ProfileNotFoundError(memberId);
	return profile;
}

/** Lists every member that has a profile, with that profile. */
export async function feedMembers(
	store: OfferStorePort,
): Promise<FeedMember[]> {
	const members = await store.listMembers();
	const result: FeedMember[] = [];
	for (const member of members) {
		const profile = await store.readMemberProfile(member.id);
		if (profile !== null) result.push({ memberId: member.id, profile });
	}
	return result;
}
