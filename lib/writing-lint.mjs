const CONTRASTIVE_REFRAMES = /\b(not just|not only|isn't just|is not just|more than just|goes beyond)\b/gi;
const GENERIC_AI_PHRASES =
  /\b(in today's fast-paced|ever-evolving landscape|game changer|unlock the power|delve into|it is worth noting|seamlessly)\b/gi;

function collectTextMatches(text, pattern) {
  const matches = [];
  const lines = text.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(line)) !== null) {
      matches.push({
        text: match[0],
        line: lineIndex + 1,
      });
      if (match[0].length === 0) break;
    }
  }
  return matches;
}

export function lintWritingText(text, options = {}) {
  const maxContrastive = options.maxContrastive ?? 1;
  const contrastive = collectTextMatches(text, CONTRASTIVE_REFRAMES);
  const generic = collectTextMatches(text, GENERIC_AI_PHRASES);
  const issues = [];

  if (contrastive.length > maxContrastive) {
    issues.push({
      id: "too_many_contrastive_reframes",
      reason: `Found ${contrastive.length} contrastive reframes; allowed ${maxContrastive}.`,
      matches: contrastive,
    });
  }
  if (generic.length > 0) {
    issues.push({
      id: "generic_ai_phrases",
      reason: `Found ${generic.length} generic AI-ish phrase${generic.length === 1 ? "" : "s"}.`,
      matches: generic,
    });
  }

  return {
    decision: issues.length === 0 ? "accepted" : "blocked",
    issues,
  };
}

