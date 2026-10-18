import { z } from "zod";
import { ConfigSchema } from "./config.js";
import { InstanceSchema } from "./instance.js";
import { ProfileSchema } from "./profile.js";

/** The one-shot bootstrap document: deployment identity, admin profile, shared config. */
export const InitInputSchema = z.object({
	instance: InstanceSchema,
	profile: ProfileSchema,
	config: ConfigSchema,
});

/** The parsed bootstrap document. */
export type InitInput = z.infer<typeof InitInputSchema>;
