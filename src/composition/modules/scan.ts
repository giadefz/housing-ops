import type { ScanPort } from "../../core/ports/application.port.js";
import { runScan } from "../scan.js";
import { withStore } from "../store.js";
import type { Wiring } from "../types.js";

/** The scan command. */
export function scanModule(wiring: Wiring): ScanPort {
	const { root, storeFactory, scanContext } = wiring;
	return {
		scan: (input) =>
			withStore(storeFactory, root, (store) =>
				runScan({
					store,
					context: scanContext,
					providerId: input.providerId,
				}),
			),
	};
}
