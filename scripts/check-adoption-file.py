#!/usr/bin/env python3
"""Check .github/workflow-rules.yaml against the repository it describes.

The adoption file is this project's self-report of which estate workflow rules
it implements. It was argued — by me, and it was written into dev-agent's R-002
card as a limit — that nothing can check such a file, because it is prose about
prose and its author is the worst-placed party to audit it.

That is true of the *claim* and false of the *pointers*. "R-008 is implemented,
see AGENTS.md § Session Model" has two parts: whether the rule is really
implemented, which no script can judge, and whether that section exists at all,
which is mechanical. The second half is where this file rots, because sections
get renamed and nothing notices — the same substrate problem R-012 describes,
applied to the self-report itself.

So this checks the shape and the pointers. It cannot and does not check that a
rule is honestly reported. A green run here means the file is well-formed and
points at text that exists, not that its claims are true.
"""
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
ADOPTION = ROOT / ".github" / "workflow-rules.yaml"

VALID = {"implemented", "partial", "diverged", "absent"}
REQUIRED_FIELD = {"partial": "gap", "diverged": "divergence"}
NEEDS_WHERE = {"implemented", "partial", "diverged"}

errors: list[str] = []


def fail(rule: str, msg: str) -> None:
    errors.append(f"  {rule}: {msg}")


def check_where(rule: str, where: str) -> None:
    """`where` is "FILE § Section" or a bare "FILE" (dev-agent rules/ADOPTION.md)."""
    if "§" in where:
        raw_file, _, section = where.partition("§")
    else:
        raw_file, section = where, ""

    path = ROOT / raw_file.strip()
    if not path.is_file():
        fail(rule, f"where names {raw_file.strip()!r}, which does not exist")
        return

    section = section.strip()
    if not section:
        return

    text = path.read_text(encoding="utf-8")
    # Markdown heading whose text is exactly the named section.
    if not re.search(rf"^#+\s+{re.escape(section)}\s*$", text, re.M):
        fail(rule, f"{path.name} has no heading {section!r}")


def main() -> int:
    if not ADOPTION.is_file():
        print(f"FAIL: {ADOPTION} is missing.")
        return 1

    doc = yaml.safe_load(ADOPTION.read_text(encoding="utf-8"))
    rules = doc.get("rules") or {}
    if not rules:
        print("FAIL: the adoption file lists no rules.")
        return 1

    for rule, entry in sorted(rules.items()):
        if not isinstance(entry, dict):
            fail(rule, "entry is not a mapping")
            continue

        status = entry.get("status")
        if status not in VALID:
            fail(rule, f"status {status!r} is not one of {sorted(VALID)}")
            continue

        needed = REQUIRED_FIELD.get(status)
        if needed and not entry.get(needed):
            fail(rule, f"status {status!r} requires a {needed!r} field")

        where = entry.get("where")
        if status in NEEDS_WHERE and not where:
            fail(rule, f"status {status!r} requires a where field")
        elif where:
            for item in where if isinstance(where, list) else [where]:
                check_where(rule, str(item))

    if errors:
        print(f"FAIL: {ADOPTION.relative_to(ROOT)} does not match this repository:")
        print("\n".join(errors))
        print("\nThis checks shape and pointers only. It cannot tell whether a rule")
        print("is honestly reported — read the entry against the section it names.")
        return 1

    print(f"OK: {len(rules)} rules, all well-formed, all pointers resolve.")
    print("    Shape and pointers only — the honesty of each claim is unaudited.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
