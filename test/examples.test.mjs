import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { loadValidation } from "../lib/core.mjs";

const EXAMPLES_DIR = "examples";
const examples = readdirSync(EXAMPLES_DIR).filter((name) => name.endsWith("VALIDATION.md"));

test("examples directory contains validation files", () => {
  assert.ok(examples.length >= 2);
});

for (const file of examples) {
  test(`examples/${file} parses and every judge is well formed`, () => {
    const validation = loadValidation({ repo: EXAMPLES_DIR, file });

    assert.equal(typeof validation.goal, "string");
    assert.ok(validation.judges.length > 0, "at least one judge");

    const ids = validation.judges.map((judge) => judge.id);
    assert.equal(new Set(ids).size, ids.length, "judge ids are unique");

    for (const judge of validation.judges) {
      assert.match(judge.id, /^[a-z][a-z0-9_]*$/, `${judge.id} is snake_case`);
      const kinds = ["run", "exists"].filter((key) => key in judge);
      assert.equal(kinds.length, 1, `${judge.id} uses exactly one of run:/exists:`);
      assert.equal(typeof judge[kinds[0]], "string", `${judge.id} ${kinds[0]}: is a string`);
      assert.ok(judge[kinds[0]].trim(), `${judge.id} ${kinds[0]}: is non-empty`);
    }
  });
}

test("examples/README.md links every example file", () => {
  const readme = readFileSync(join(EXAMPLES_DIR, "README.md"), "utf8");
  for (const file of examples) {
    assert.ok(readme.includes(`](${file})`), `README links ${file}`);
  }
});
