import { ConfigNotFoundError } from "../errors/config.js";
import type { OfferStorePort } from "../ports/store.port.js";
import { ConfigSchema, type Config } from "../schemas/config.js";

/** One request to read the shared config. */
export interface ConfigRequest {
	store: OfferStorePort;
}

/** One request to replace the shared config. */
export interface SetConfigRequest extends ConfigRequest {
	config: Config;
}

/** Reads the shared config, or throws when the instance is not initialized. */
export async function getConfig(request: ConfigRequest): Promise<Config> {
	const config = await request.store.readConfig();
	if (config === null) throw new ConfigNotFoundError();
	return config;
}

/** Validates and writes the shared config. */
export async function setConfig(request: SetConfigRequest): Promise<Config> {
	const config = ConfigSchema.parse(request.config);
	await request.store.writeConfig(config);
	return config;
}
