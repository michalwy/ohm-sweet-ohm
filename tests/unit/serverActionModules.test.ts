import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";

// Every exported async function of a "use server" module is a server action the browser can call
// directly, past any authorization its caller performs. Internal helpers that run inside a
// caller's transaction must live in a module without the directive (#291, #295).

const srcRoot = new URL("../../src/", import.meta.url).pathname;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "generated" ? [] : listSourceFiles(path);
    }
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function exportedSignatures(source: string) {
  const signatures: Array<{ name: string; signature: string }> = [];
  for (const match of source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)) {
    const rest = source.slice(match.index);
    // The signature ends on the line that opens the body: the export line itself when it closes
    // its parameter list, or the first line that starts with `)` or `}` and ends with `{`.
    const end = rest.search(/^(?:export[^\n]*\)|[)}])[^\n]*\{[ \t]*$/m);
    signatures.push({ name: match[1], signature: rest.slice(0, end === -1 ? 400 : rest.indexOf("\n", end)) });
  }
  return signatures;
}

const serverActionModules = listSourceFiles(srcRoot)
  .map((path) => ({ path: relative(srcRoot, path), source: readFileSync(path, "utf8") }))
  .filter(({ source }) => /^\s*["']use server["'];/.test(source));

describe("\"use server\" modules export only server actions (#295)", () => {
  test("the scan finds the server action modules", () => {
    assert.ok(serverActionModules.length > 0);
  });

  test("no exported function takes a transaction client", () => {
    const offenders = serverActionModules.flatMap(({ path, source }) =>
      exportedSignatures(source)
        .filter(({ signature }) => /TransactionClient|\btx\b/.test(signature))
        .map(({ name }) => `${path}: ${name}`)
    );
    assert.deepEqual(offenders, []);
  });
});
