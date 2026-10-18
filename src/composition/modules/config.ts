import { assertInstanceWritable } from "../../adapters/secondary/instance.js";
import type { ConfigPort } from "../../core/ports/application.port.js";
import { getConfig, setConfig } from "../../core/services/config.service.js";
import { initWorkspace } from "../../core/services/init.service.js";
import {
	getMemberProfile,
	setMemberProfile,
} from "../../core/services/profile.service.js";
import { withStore } from "../store.js";
import type { Wiring } from "../types.js";

/** Bootstrap, the shared config, and member profiles. */
export function configModule(wiring: Wiring): ConfigPort {
	const { root, storeFactory, writeInstance } = wiring;
	return {
		init: async (request) => {
			assertInstanceWritable(root, request.force);
			const description = storeFactory.init(root);
			return withStore(storeFactory, root, (store) =>
				initWorkspace({
					input: request.input,
					force: request.force,
					writeInstance: (instance, force) =>
						writeInstance(root, instance, force),
					store,
					database: description.location,
				}),
			);
		},
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
