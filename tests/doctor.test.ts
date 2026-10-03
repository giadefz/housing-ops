import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { doctor, version } from "../src/api/commands.js";

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  roots = [];
});

function emptyRoot(): string {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
  roots.push(r);
  return r;
}

describe("version", () => {
  it("reports api 1", () => {
    const v = version();
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.data.api).toBe(1);
  });
});

describe("doctor on empty root", () => {
  it("fails every config check gracefully without throwing", () => {
    const result = doctor(emptyRoot());
    expect(result.ok).toBe(true); // the command succeeds; the checks fail
    if (!result.ok) return;
    const byName = Object.fromEntries(result.data.checks.map((c) => [c.name, c]));
    for (const f of ["profile.yml", "pipeline.yml", "providers.yml", "extensions.yml"]) {
      expect(byName[`config.${f}`].ok).toBe(false);
      expect(byName[`config.${f}`].detail).toMatch(/setup/);
    }
    expect(byName["db"].ok).toBe(false);
    expect(byName["api"].ok).toBe(true);
  });

  it("passes a present valid config file", () => {
    const root = emptyRoot();
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(path.join(root, "config", "profile.yml"), "version: 1\n");
    const result = doctor(root);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const check = result.data.checks.find((c) => c.name === "config.profile.yml");
    expect(check?.ok).toBe(true);
  });

  it("fails an invalid config file with the reason", () => {
    const root = emptyRoot();
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(path.join(root, "config", "profile.yml"), "version: 2\n");
    const result = doctor(root);
    if (!result.ok) throw new Error("doctor itself must not fail");
    const check = result.data.checks.find((c) => c.name === "config.profile.yml");
    expect(check?.ok).toBe(false);
    expect(check?.detail).toMatch(/invalid/);
  });
});
