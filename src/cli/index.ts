#!/usr/bin/env node
// Thin argv wrapper over src/api. Prints one JSON envelope to stdout,
// human logs (none yet) to stderr. Exit 0 on ok, 1 on failure, 2 on usage error.
import { pathToFileURL } from "node:url";
import { doctor, version } from "../api/commands.js";
import { fail, type Envelope } from "../api/envelope.js";

export interface ParsedArgs {
  command: string | null;
  flags: Record<string, string | boolean>;
  rest: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [, , ...tokens] = argv;
  let command: string | null = null;
  const flags: Record<string, string | boolean> = {};
  const rest: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as string;
    if (t.startsWith("--")) {
      const eq = t.indexOf("=");
      if (eq === -1) {
        const next = tokens[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[t.slice(2)] = next;
          i++;
        } else {
          flags[t.slice(2)] = true;
        }
      } else {
        flags[t.slice(2, eq)] = t.slice(eq + 1);
      }
    } else if (command === null) {
      command = t;
    } else {
      rest.push(t);
    }
  }
  return { command, flags, rest };
}

const HELP = {
  commands: [
    { name: "version", status: "implemented" },
    { name: "doctor", status: "implemented" },
    { name: "setup", status: "planned (Phase 7)" },
    { name: "scan", status: "planned (Phase 2–4)" },
    { name: "queue", status: "planned (Phase 5)" },
    { name: "offer get", status: "planned (Phase 1)" },
    { name: "verdict set", status: "planned (Phase 5)" },
    { name: "interact", status: "planned (Phase 5)" },
    { name: "prefs", status: "planned (Phase 5)" },
    { name: "filter", status: "planned (Phase 3)" },
    { name: "provider", status: "planned (Phase 2)" },
    { name: "publish", status: "planned (Phase 6)" },
  ],
};

function print(env: Envelope<unknown>): void {
  process.stdout.write(JSON.stringify(env, null, 2) + "\n");
}

function main(): void {
  const { command, flags } = parseArgs(process.argv);
  if (command === null || command === "help" || flags["help"] === true) {
    print({ ok: true, version: 1, data: HELP });
    return;
  }
  try {
    switch (command) {
      case "version":
        print(version());
        return;
      case "doctor":
        print(doctor());
        return;
      default:
        print(
          fail(
            "UNKNOWN_COMMAND",
            `unknown command: ${command}`,
            "run housing-ops help for the command list",
          ),
        );
        process.exitCode = 2;
    }
  } catch (e) {
    print(fail("INTERNAL_ERROR", (e as Error).message));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
