/**
 * A rule is { id, pattern, reason(count, limit), limit? }.
 * `limit` is the number of matches allowed before the rule fires (default 0).
 * Rule limits can be overridden per call via options.limits[id]; options.maxContrastive
 * is kept as a shorthand for limits.too_many_contrastive_reframes.
 */
export const WRITING_RULES = [
  {
    id: "too_many_contrastive_reframes",
    pattern: /\b(not just|not only|isn't just|is not just|more than just|goes beyond)\b/gi,
    limit: 1,
    reason: (count, limit) => `Found ${count} contrastive reframes; allowed ${limit}.`,
  },
  {
    id: "generic_ai_phrases",
    pattern:
      /\b(in today's fast-paced|ever-evolving landscape|game changer|unlock the power|delve into|it is worth noting|seamlessly)\b/gi,
    reason: (count) => `Found ${count} generic AI-ish phrase${count === 1 ? "" : "s"}.`,
  },
  {
    id: "hollow_intensifiers",
    pattern: /\b(truly|genuinely|incredibly|remarkably|profoundly) (transformative|powerful|important|unique|revolutionary)\b/gi,
    reason: (count) => `Found ${count} hollow intensifier${count === 1 ? "" : "s"}.`,
  },
  {
    id: "closing_boilerplate",
    pattern: /\b(in conclusion|to sum up|at the end of the day|the bottom line is)\b/gi,
    reason: (count) => `Found ${count} boilerplate closer${count === 1 ? "" : "s"}.`,
  },
];

export function collectTextMatches(text, pattern) {
  const matches = [];
  const lines = text.split(/\r?\n/);
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  lines.forEach((line, index) => {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(line)) !== null) {
      matches.push({ text: match[0], line: index + 1 });
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  });
  return matches;
}

export function lintWritingText(text, options = {}) {
  const rules = options.rules ?? WRITING_RULES;
  const limits = { ...options.limits };
  if (options.maxContrastive !== undefined) {
    limits.too_many_contrastive_reframes = options.maxContrastive;
  }

  const issues = [];
  for (const rule of rules) {
    const limit = limits[rule.id] ?? rule.limit ?? 0;
    const matches = collectTextMatches(text, rule.pattern);
    if (matches.length > limit) {
      issues.push({ id: rule.id, reason: rule.reason(matches.length, limit), matches });
    }
  }

  return {
    decision: issues.length === 0 ? "accepted" : "blocked",
    issues,
  };
}
