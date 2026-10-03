// Versioned use-case surface. src/cli maps argv onto these functions;
// future interfaces (REST, UI) call them directly. Contracts: docs/design/api.md.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import yaml from "js-yaml";
import {
  API_VERSION,
  CORE_VERSION,
  ok,
  type Envelope,
} from "./envelope.js";
import {
  CONFIG_FILES,
  ConfigSchemas,
  ExtensionPinSchema,
  configPath,
  dbPath,
  resolveRoot,
} from "../core/config.js";

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

const SETUP_HINT = "run housing-ops setup";

export function version(): Envelope<{ core: string; api: number }> {
  return ok({ core: CORE_VERSION, api: API_VERSION });
}

function checkConfigFile(root: string, file: (typeof CONFIG_FILES)[number]): Check {
  const p = configPath(root, file);
  if (!fs.existsSync(p)) {
    return { name: `config.${file}`, ok: false, detail: `missing — ${SETUP_HINT}` };
  }
  try {
    ConfigSchemas[file].parse(yaml.load(fs.readFileSync(p, "utf8")));
    return { name: `config.${file}`, ok: true };
  } catch (e) {
    return {
      name: `config.${file}`,
      ok: false,
      detail: `invalid: ${(e as Error).message}`,
    };
  }
}

function checkPins(root: string): Check[] {
  const raw = fs.existsSync(configPath(root, "extensions.yml"))
    ? yaml.load(fs.readFileSync(configPath(root, "extensions.yml"), "utf8"))
    : null;
  const pins = (raw as { pins?: unknown[] } | null)?.pins ?? [];
  if (pins.length === 0) return [{ name: "extensions", ok: true, detail: "nothing pinned" }];
  return pins.map((pin, i) => {
    const parsed = ExtensionPinSchema.safeParse(pin);
    if (!parsed.success) {
      return { name: `extension[${i}]`, ok: false, detail: `invalid pin: ${parsed.error.message}` };
    }
    const abs = path.resolve(root, parsed.data.path);
    if (!fs.existsSync(abs)) {
      return { name: `extension.${parsed.data.id}`, ok: false, detail: `pinned file missing: ${parsed.data.path}` };
    }
    const hash = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
    if (hash !== parsed.data.sha256) {
      return {
        name: `extension.${parsed.data.id}`,
        ok: false,
        detail: "file changed since approval — re-approve to load it",
      };
    }
    return { name: `extension.${parsed.data.id}`, ok: true };
  });
}

export function doctor(root: string = resolveRoot()): Envelope<{ checks: Check[] }> {
  const checks: Check[] = CONFIG_FILES.map((file) => checkConfigFile(root, file));
  checks.push(...checkPins(root));
  checks.push(
    fs.existsSync(dbPath(root))
      ? { name: "db", ok: true, detail: "data/housing.db present" }
      : { name: "db", ok: false, detail: `not initialized — ${SETUP_HINT}` },
  );
  checks.push({ name: "api", ok: true, detail: `api ${API_VERSION}` });
  return ok({ checks });
}
