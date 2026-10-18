import { z } from "zod";
import { MARKETS } from "../domain/offer.js";

/** The interfaces an instance can expose. */
export const INSTANCE_INTERFACES = ["cli", "http", "mcp"] as const;

/** An interface an instance can expose. */
export type InstanceInterface = (typeof INSTANCE_INTERFACES)[number];

/** Deployment identity (instance.yml). Secrets come from the environment. */
export const InstanceSchema = z.object({
	version: z.literal(1),
	name: z.string().min(1),
	country: z.string().min(1),
	market: z.enum(MARKETS),
	interfaces: z.array(z.enum(INSTANCE_INTERFACES)).min(1).default(["cli"]),
	auth: z
		.object({
			issuer: z.string().url().optional(),
			clientId: z.string().min(1).optional(),
			audience: z.string().min(1).optional(),
		})
		.optional(),
});

/** The parsed deployment identity. */
export type Instance = z.infer<typeof InstanceSchema>;
