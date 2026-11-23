import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `scripts/ci/wait-for-checks.sh` is how a thread waits for CI in one call, and it decides whether
// the author merges its own pull request — so a green it reports must be a real one. It runs the
// script itself with `gh` replaced by a stub. What that leaves untested is the `--jq` filter that
// turns GitHub's answer into tab-separated lines; the stub starts from those lines.
//
// The stub answers the pull request read with a fixed head, and the check-runs read with the next
// of a sequence of polls, repeating the last one — so a run can be pending first and green later.

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const script = path.join(repoRoot, "scripts", "ci", "wait-for-checks.sh");
const SHA = "abc1230000000000000000000000000000000000";

// The required checks come from the ruleset artifact, as the script reads them, so a check added to
// the ruleset is covered here without editing this file.
const REQUIRED: string[] = JSON.parse(
  readFileSync(path.join(repoRoot, ".github", "rulesets", "main.json"), "utf8"),
)
  .rules.filter((r: { type: string }) => r.type === "required_status_checks")
  .flatMap((r: { parameters: { required_status_checks: { context: string }[] } }) =>
    r.parameters.required_status_checks.map((c) => c.context),
  );

let dir: string;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "wait-for-checks-"));
  const gh = path.join(dir, "gh");
  writeFileSync(
    gh,
    [
      "#!/usr/bin/env bash",
      'case "$*" in',
      `  *"/pulls/"*) echo ${SHA}; exit 0 ;;`,
      "esac",
      'n=$(cat "$STUB_DIR/count" 2>/dev/null || echo 0)',
      'echo $((n + 1)) > "$STUB_DIR/count"',
      'f="$STUB_DIR/poll.$n"',
      '[ -f "$f" ] || f=$(ls "$STUB_DIR"/poll.* | sort -t. -k2 -n | tail -1)',
      'cat "$f"',
      "",
    ].join("\n"),
  );
  chmodSync(gh, 0o755);
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

type Run = [name: string, status: string, conclusion: string, startedAt: string];

function line([name, status, conclusion, startedAt]: Run) {
  return [name, status, conclusion, startedAt, `https://example.test/${encodeURIComponent(name)}`].join("\t");
}

function all(conclusion: string, status = "completed"): Run[] {
  return REQUIRED.map((name) => [name, status, conclusion, "2026-11-22T10:00:00Z"]);
}

function wait(polls: Run[][], timeout = "60") {
  const stub = mkdtempSync(path.join(dir, "run-"));
  polls.forEach((runs, i) => writeFileSync(path.join(stub, `poll.${i}`), runs.map(line).join("\n") + "\n"));
  const result = spawnSync("bash", [script, "7"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30_000,
    env: {
      PATH: `${dir}${path.delimiter}${process.env.PATH ?? ""}`,
      HOME: process.env.HOME ?? dir,
      NODE_ENV: "test",
      STUB_DIR: stub,
      GH_REPO_PATH: "owner/repo",
      WAIT_INTERVAL: "0",
      WAIT_TIMEOUT: timeout,
    },
  });
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines.length, 1, `exactly one line of output, got:\n${result.stdout}${result.stderr}`);
  return { status: result.status, out: lines[0] };
}

describe("wait-for-checks.sh", () => {
  it("reads the required checks from the ruleset artifact", () => {
    assert.ok(REQUIRED.includes("Closing reference check"), REQUIRED.join(", "));
    assert.ok(REQUIRED.length >= 4, REQUIRED.join(", "));
  });

  it("reports green when every required check succeeds", () => {
    const { status, out } = wait([all("success")]);
    assert.equal(status, 0);
    assert.match(out, new RegExp(`^green ${SHA} PR #7`));
  });

  it("waits through pending polls and then reports once", () => {
    const { status, out } = wait([[], all("none", "in_progress"), all("success")]);
    assert.equal(status, 0, out);
    assert.match(out, /^green /);
  });

  it("reports red, naming the failed check, without waiting for the rest", () => {
    const runs = all("none", "in_progress");
    runs[0] = [REQUIRED[0], "completed", "failure", "2026-11-22T10:00:00Z"];
    const { status, out } = wait([runs]);
    assert.equal(status, 1);
    assert.match(out, new RegExp(`^red .*${REQUIRED[0]}=failure https://example\\.test/`));
  });

  it("never counts a skipped required check as green", () => {
    const runs = all("success");
    runs[1] = [REQUIRED[1], "completed", "skipped", "2026-11-22T10:00:00Z"];
    const { status, out } = wait([runs]);
    assert.equal(status, 1);
    assert.match(out, /=skipped /);
  });

  it("ignores a check that is not required", () => {
    const extra: Run = ["Publish container image", "completed", "failure", "2026-11-22T10:00:00Z"];
    assert.equal(wait([[...all("success"), extra]]).status, 0);
  });

  it("reads a re-run by its latest start, in either direction", () => {
    const name = REQUIRED[REQUIRED.length - 1];
    const rerunGreen: Run[] = [...all("success"), [name, "completed", "failure", "2026-11-22T09:00:00Z"]];
    assert.equal(wait([rerunGreen]).status, 0);
    const rerunRed: Run[] = [...all("success"), [name, "completed", "cancelled", "2026-11-22T11:00:00Z"]];
    assert.equal(wait([rerunRed]).status, 1);
  });

  it("is not green while a required check is missing, and times out naming it", () => {
    const { status, out } = wait([all("success").slice(1)], "0");
    assert.equal(status, 2);
    assert.match(out, new RegExp(`^timeout .*${REQUIRED[0]}=missing`));
  });

  it("rejects a missing pull request number", () => {
    const result = spawnSync("bash", [script], { encoding: "utf8" });
    assert.equal(result.status, 3);
  });
});
