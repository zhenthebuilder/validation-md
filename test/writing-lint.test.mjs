import assert from "node:assert/strict";
import test from "node:test";
import { WRITING_RULES, collectTextMatches, lintWritingText } from "../lib/writing-lint.mjs";

const ruleIds = WRITING_RULES.map((rule) => rule.id);

test("every rule has a unique id, a regex pattern and a reason function", () => {
  assert.equal(new Set(ruleIds).size, ruleIds.length);
  for (const rule of WRITING_RULES) {
    assert.ok(rule.pattern instanceof RegExp, rule.id);
    assert.equal(typeof rule.reason, "function", rule.id);
    assert.match(rule.reason(2, 1), /2/, rule.id);
  }
});

test("collectTextMatches reports 1-based line numbers for every occurrence", () => {
  const matches = collectTextMatches("a b a\n\na", /a/g);
  assert.deepEqual(matches, [
    { text: "a", line: 1 },
    { text: "a", line: 1 },
    { text: "a", line: 3 },
  ]);
});

test("collectTextMatches handles patterns without the g flag and empty matches", () => {
  assert.equal(collectTextMatches("xx", /x/i).length, 2);
  assert.ok(collectTextMatches("ab", /y*/g).length > 0);
});

const samples = {
  too_many_contrastive_reframes: "It is not just fast. It is not only cheap.",
  generic_ai_phrases: "Let us delve into the topic.",
  hollow_intensifiers: "This is a truly transformative change.",
  closing_boilerplate: "In conclusion, ship it.",
};

for (const rule of WRITING_RULES) {
  test(`rule ${rule.id} fires on its sample and only on its sample`, () => {
    assert.ok(rule.id in samples, `add a sample for ${rule.id}`);
    const result = lintWritingText(samples[rule.id]);
    assert.deepEqual(
      result.issues.map((issue) => issue.id),
      [rule.id],
    );
  });
}

test("limits can be overridden per rule and via maxContrastive shorthand", () => {
  const text = samples.too_many_contrastive_reframes;
  assert.equal(lintWritingText(text).decision, "blocked");
  assert.equal(lintWritingText(text, { limits: { too_many_contrastive_reframes: 2 } }).decision, "accepted");
  assert.equal(lintWritingText(text, { maxContrastive: 2 }).decision, "accepted");
  assert.equal(lintWritingText("delve into", { limits: { generic_ai_phrases: 1 } }).decision, "accepted");
});

test("custom rule sets replace the defaults", () => {
  const rules = [{ id: "no_todo", pattern: /TODO/g, reason: (n) => `${n} TODOs` }];
  const result = lintWritingText("TODO: delve into it", { rules });
  assert.deepEqual(result.issues.map((issue) => issue.id), ["no_todo"]);
  assert.equal(result.issues[0].reason, "1 TODOs");
});

test("issues are reported in rule order with line-numbered matches", () => {
  const result = lintWritingText("not just\nnot only\ndelve into", { maxContrastive: 0 });
  assert.deepEqual(result.issues.map((issue) => issue.id), [
    "too_many_contrastive_reframes",
    "generic_ai_phrases",
  ]);
  assert.deepEqual(result.issues[1].matches, [{ text: "delve into", line: 3 }]);
});
