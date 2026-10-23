import { createServer } from "node:http";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeValidation } from "../lib/core.mjs";

const page = readFileSync(new URL("./index.html", import.meta.url));
const markdown = `# VALIDATION.md

This task is done only when every judge passes.

\`\`\`validation
goal: Checkout change is ready for review
judges:
  - id: checkout_tests_pass
    run: node checkout-check.mjs

  - id: review_evidence_exists
    exists: review-notes.md
\`\`\`
`;
createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && req.url === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(page);
  }
  if (req.method === "GET" && req.url === "/api/definition") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ markdown }));
  }
  if (req.method !== "POST" || req.url !== "/api/run") {
    res.writeHead(404); return res.end("Not found");
  }
  let repo;
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 2048) throw new Error("Request too large");
    }
    const input = JSON.parse(body);
    if (typeof input.fixed !== "boolean" || typeof input.evidence !== "boolean") throw new Error("Expected boolean fixture settings");
    repo = mkdtempSync(join(tmpdir(), "validation-demo-"));
    writeFileSync(join(repo, "VALIDATION.md"), markdown);
    writeFileSync(join(repo, "checkout-check.mjs"), `import assert from 'node:assert/strict';
const total = (subtotal, discount) => ${input.fixed ? "subtotal - discount" : "subtotal + discount"};
try { assert.equal(total(100, 20), 80); console.log('PASS: $100 subtotal − $20 discount = $80'); }
catch { console.error('FAIL: expected $80, received $' + total(100, 20)); process.exitCode = 1; }`);
    if (input.evidence) writeFileSync(join(repo, "review-notes.md"), "# Demo review evidence\nDiscount calculation reviewed against the $100 minus $20 case.\n");
    const result = executeValidation({ repo, file: "VALIDATION.md" });
    result.file = "VALIDATION.md";
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  } finally {
    if (repo) rmSync(repo, { recursive: true, force: true });
  }
}).listen(Number(process.env.PORT || 3000), "0.0.0.0", () => console.log("Validation demo listening on port 3000"));
