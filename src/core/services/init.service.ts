import { DEFAULT_MEMBER_ID } from "../domain/member.js";
import type { InitResult } from "../ports/application.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import type { Instance } from "../schemas/instance.js";
import type { InitInput } from "../schemas/init.js";

/** One request to initialize an instance. */
export interface InitRequest {
	input: InitInput;
	force: boolean;
	writeInstance: (instance: Instance, force: boolean) => void;
	store: OfferStorePort;
	database: string;
}

/** Writes the deployment identity, shared config, and admin profile. */
export async function initWorkspace(request: InitRequest): Promise<InitResult> {
	const { input, force, writeInstance, store, database } = request;
	writeInstance(input.instance, force);
	await store.writeConfig(input.config);
	await store.writeMemberProfile(DEFAULT_MEMBER_ID, input.profile);
	return { instance: input.instance, database };
}
