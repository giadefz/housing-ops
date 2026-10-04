import { z } from "zod";

/** An approved extension: its kind, location, hash, and approval time. */
export const ExtensionApprovalSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(["filter", "provider", "publisher", "storage"]),
	path: z.string().min(1),
	sha256: z.string().min(1),
	approved_at: z.coerce.string().min(1),
});

export type ExtensionApproval = z.infer<typeof ExtensionApprovalSchema>;

/** The extensions.yml file. */
export const ExtensionsFileSchema = z
	.object({
		version: z.literal(1),
		approvals: z.array(z.unknown()).optional(),
	})
	.catchall(z.unknown());
