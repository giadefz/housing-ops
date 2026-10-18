import type { VersionInfo } from "./ports/application.port.js";

export const API_VERSION = 2;
export const CORE_VERSION = "0.1.0";

export function getVersion(): VersionInfo {
	return { core: CORE_VERSION, api: API_VERSION };
}
