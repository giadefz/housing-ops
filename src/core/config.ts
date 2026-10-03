// Config file locations and minimal schemas. Full per-file shapes live in
// docs/design/config.md; schemas grow with the phases that use them.
import path from "node:path";
import { z } from "zod";

export const CONFIG_FILES = [
  "profile.yml",
  "pipeline.yml",
  "providers.yml",
  "extensions.yml",
] as const;

export type ConfigFile = (typeof CONFIG_FILES)[number];

// Phase 0: every config file must at least carry `version: 1`.
const BaseConfig = z.object({ version: z.literal(1) }).catchall(z.unknown());

export const ConfigSchemas: Record<ConfigFile, typeof BaseConfig> = {
  "profile.yml": BaseConfig,
  "pipeline.yml": BaseConfig,
  "providers.yml": BaseConfig,
  "extensions.yml": BaseConfig,
};

export interface ExtensionPin {
  id: string;
  kind: "filter" | "provider" | "publisher" | "storage";
  path: string;
  sha256: string;
  approved_at: string;
}

export const ExtensionPinSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["filter", "provider", "publisher", "storage"]),
  path: z.string().min(1),
  sha256: z.string().min(1),
  approved_at: z.string().min(1),
});

export function resolveRoot(): string {
  return process.env.HOUSING_OPS_ROOT ?? process.cwd();
}

export function configPath(root: string, file: ConfigFile): string {
  return path.join(root, "config", file);
}

export function dbPath(root: string): string {
  return path.join(root, "data", "housing.db");
}
