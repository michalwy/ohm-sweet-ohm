import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import ts from "typescript";

import {
  findCoverageProblems,
  pendingCoverage,
  serverActionCoverage
} from "../../src/server/mcp/coverage";

/**
 * MCP coverage check (#276): every exported server action is mapped to an MCP tool or excluded
 * with a reason (`src/server/mcp/coverage.ts`). The server actions are found by reading the source,
 * as Next.js does: every exported function of a module whose first statement is `"use server"`.
 */

function isUseServerDirective(statement: ts.Statement | undefined) {
  return (
    statement !== undefined &&
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression) &&
    statement.expression.text === "use server"
  );
}

function hasExportModifier(statement: ts.Statement) {
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    )
  );
}

function hasDefaultModifier(statement: ts.Statement) {
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword
    )
  );
}

/**
 * What a source file publishes as server actions: for a `"use server"` module its exported values
 * (types are erased, so they are not actions), and for any module the functions with an inline
 * `"use server"` directive, which this check does not cover and so reports.
 */
function readServerActions(fileName: string, source: string) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const actions: string[] = [];
  const inline: string[] = [];

  if (isUseServerDirective(sourceFile.statements[0])) {
    for (const statement of sourceFile.statements) {
      if (ts.isExportDeclaration(statement)) {
        if (!statement.isTypeOnly && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) {
            if (!element.isTypeOnly) actions.push(element.name.text);
          }
        } else if (!statement.isTypeOnly) {
          actions.push(`* from ${statement.moduleSpecifier?.getText(sourceFile) ?? "?"}`);
        }
      } else if (ts.isExportAssignment(statement)) {
        actions.push("default");
      } else if (hasExportModifier(statement)) {
        if (ts.isFunctionDeclaration(statement)) {
          actions.push(hasDefaultModifier(statement) ? "default" : (statement.name?.text ?? "default"));
        } else if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            actions.push(declaration.name.getText(sourceFile));
          }
        } else if (ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) {
          actions.push(statement.name?.text ?? "default");
        }
        // Type aliases and interfaces are erased: not actions.
      }
    }
  }

  const visit = (node: ts.Node) => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      node.body &&
      ts.isBlock(node.body) &&
      isUseServerDirective(node.body.statements[0])
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      inline.push(`${fileName}:${line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return { actions, inline };
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [full] : [];
  });
}

function scanRepository() {
  const actions = new Map<string, string[]>();
  const inline: string[] = [];

  for (const file of sourceFiles("src")) {
    const relative = file.split(path.sep).join("/");
    const found = readServerActions(relative, readFileSync(file, "utf8"));
    if (found.actions.length > 0) actions.set(relative, found.actions);
    inline.push(...found.inline);
  }

  return { actions, inline };
}

describe("MCP coverage of server actions (#276)", () => {
  const repository = scanRepository();

  test("finds the server actions (the scan is not empty)", () => {
    assert.ok(repository.actions.size > 10, "no \"use server\" modules found under src/");
  });

  test("every server action is mapped to an MCP tool or excluded with a reason", () => {
    assert.deepEqual(findCoverageProblems(repository.actions, serverActionCoverage), []);
  });

  test("no server action is declared inline", () => {
    // An inline "use server" function would escape the scan above; keep actions in modules.
    assert.deepEqual(repository.inline, []);
  });

  test("pending entries wait only for the milestone's area issues (#277–#286)", () => {
    for (const issue of pendingCoverage(serverActionCoverage).keys()) {
      const number = Number(issue.slice(1));
      assert.ok(number >= 277 && number <= 286, `${issue} is not an area issue of the milestone`);
    }
  });

  test("a new unmapped, unexcluded action fails the check", () => {
    const withNewAction = new Map(repository.actions);
    withNewAction.set("src/server/widgets/widgetActions.ts", ["createWidgetForWorkspace"]);

    const problems = findCoverageProblems(withNewAction, serverActionCoverage);

    assert.equal(problems.length, 1);
    assert.match(problems[0], /widgetActions\.ts#createWidgetForWorkspace .*no MCP coverage entry/);
  });

  test("a new action in an existing module fails the check", () => {
    const withNewAction = new Map(repository.actions);
    const file = "src/server/units/unitActions.ts";
    withNewAction.set(file, [...(withNewAction.get(file) ?? []), "mergeUnitsForWorkspace"]);

    assert.equal(findCoverageProblems(withNewAction, serverActionCoverage).length, 1);
  });

  test("an entry for an action that no longer exists fails the check", () => {
    const withoutAction = new Map(repository.actions);
    withoutAction.set(
      "src/server/auth/actions.ts",
      (withoutAction.get("src/server/auth/actions.ts") ?? []).filter((name) => name !== "signOut")
    );

    const problems = findCoverageProblems(withoutAction, serverActionCoverage);

    assert.deepEqual(problems, [
      "src/server/auth/actions.ts#signOut has a coverage entry but is no longer a server action."
    ]);
  });

  test("an exclusion needs a reason", () => {
    const problems = findCoverageProblems(new Map([["a.ts", ["x"]]]), {
      "a.ts": { x: { excluded: " " } }
    });

    assert.deepEqual(problems, ["a.ts#x is excluded without a reason."]);
  });
});

describe("reading server actions from source", () => {
  test("lists a \"use server\" module's exported values, not its types", () => {
    const { actions } = readServerActions(
      "x.ts",
      [
        '"use server";',
        "export type Result = { ok: boolean };",
        "export interface Shape { a: string }",
        "export async function first() {}",
        "export const second = async () => {};",
        "async function third() {}",
        "async function hidden() {}",
        "export { third, hidden as renamed };",
        "export type { Shape as Other };",
        "export default async function () {}"
      ].join("\n")
    );

    assert.deepEqual(actions, ["first", "second", "third", "renamed", "default"]);
  });

  test("ignores a module without the directive, or with it below the first statement", () => {
    assert.deepEqual(
      readServerActions("x.ts", "export async function a() {}").actions,
      []
    );
    assert.deepEqual(
      readServerActions("x.ts", 'import "x";\n"use server";\nexport async function a() {}').actions,
      []
    );
  });

  test("reports inline server actions", () => {
    const { inline } = readServerActions(
      "x.tsx",
      'export function Page() {\n  async function act() {\n    "use server";\n  }\n  return act;\n}'
    );

    assert.deepEqual(inline, ["x.tsx:2"]);
  });
});
