import { z } from "zod";

/** Minimal schema for a config file that carries only a version so far. */
export const BaseConfig = z
	.object({ version: z.literal(1) })
	.catchall(z.unknown());
