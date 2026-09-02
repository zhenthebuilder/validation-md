export function createOutput(stdout = process.stdout, stderr = process.stderr) {
  return {
    line(text = "") {
      stdout.write(`${text}\n`);
    },
    json(payload) {
      stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    },
    error(text) {
      stderr.write(`${text}\n`);
    },
  };
}

export function formatValidation(payload) {
  const lines = [`Validation.md: ${payload.decision}`, payload.goal];
  for (const judge of payload.judges) {
    lines.push(`- ${judge.status === "passed" ? "PASS" : "FAIL"} ${judge.id}: ${judge.reason}`);
  }
  return lines;
}

export function formatWritingLint(payload) {
  if (payload.decision === "accepted") return ["Writing lint: accepted"];
  const lines = ["Writing lint: blocked"];
  for (const issue of payload.issues) {
    lines.push(`- ${issue.id}: ${issue.reason}`);
    for (const match of issue.matches) {
      lines.push(`  line ${match.line}: ${match.text}`);
    }
  }
  return lines;
}

export function formatFailedJudges(failed) {
  return failed.map((judge) => `- ${judge.id}: ${judge.reason}`).join("\n");
}

export function hookBlock(reason) {
  return { decision: "block", reason };
}
