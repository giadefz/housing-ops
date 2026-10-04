export const API_VERSION = 1;
export const CORE_VERSION = "0.1.0";

/** Core and api versions, for compatibility checks between core and interfaces. */
export interface VersionInfo {
	core: string;
	api: number;
}

export function getVersion(): VersionInfo {
	return { core: CORE_VERSION, api: API_VERSION };
}
