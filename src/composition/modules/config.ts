import { assertInstanceWritable } from "../../adapters/secondary/instance.js";
import { readLegacyConfig } from "../../adapters/secondary/legacy-config.js";
import type { ConfigPort } from "../../core/ports/application.port.js";
import type { InitInput } from "../../core/schemas/init.js";
import { getConfig, setConfig } from "../../core/services/config.service.js";
import { buildImportInput } from "../../core/services/import.service.js";
import { initWorkspace } from "../../core/services/init.service.js";
import {
	getMemberProfile,
	setMemberProfile,
} from "../../core/services/profile.service.js";
import { withStore } from "../store.js";
import type { Wiring } from "../types.js";

/** Bootstrap, import, the shared config, and member profiles. */
export function configModule(wiring: Wiring): ConfigPort {
	const { root, storeFactory, writeInstance } = wiring;

	async function initialize(input: InitInput, force: boolean) {
		assertInstanceWritable(root, force);
		const description = storeFactory.init(root);
		return withStore(storeFactory, root, (store) =>
			initWorkspace({
				input,
				force,
				writeInstance: (instance, replace) =>
					writeInstance(root, instance, replace),
				store,
				database: description.location,
			}),
		);
	}

	return {
		init: (request) => initialize(request.input, request.force),
		importConfig: (request) =>
			initialize(
				buildImportInput({
					documents: readLegacyConfig(root),
					name: request.name,
				}),
				request.force,
			),
		getConfig: () =>
			withStore(storeFactory, root, (store) => getConfig({ store })),
		setConfig: (next) =>
			withStore(storeFactory, root, (store) =>
				setConfig({ store, config: next }),
			),
		getProfile: (input) =>
			withStore(storeFactory, root, (store) =>
				getMemberProfile({
					store,
					memberId: input.memberId,
					path: input.path,
				}),
			),
		setProfile: (input) =>
			withStore(storeFactory, root, (store) =>
				setMemberProfile({
					store,
					memberId: input.memberId,
					path: input.path,
					value: input.value,
				}),
			),
	};
}
