#!/usr/bin/env node
// Validates a Vulcan audit trail (messages.jsonl) against CLAUDE.md:
//   - every line is a JSON object whose type is in the Message Protocol
//   - every field shown in the protocol example is present; enums are valid
//   - one session per file; the run starts with FEATURE_PLAN
//   - experts and reviewers only report for agents the Architect assigned
//   - Phase 3 completes before Phase 4: all assigned experts report before any review
//   - the gate held: SHIP_DONE only after every assigned expert was reviewed and
//     no reviewer blocked and the security risk score stayed below 7
//
// Usage: node scripts/validate-messages.mjs <messages.jsonl> [more.jsonl ...]
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENUMS, SECURITY_BLOCK_THRESHOLD, loadProtocol } from "./lib/protocol.mjs";

/** Parse JSONL text into { messages, errors }. Blank lines are ignored. */
export function parseJsonl(text) {
  const messages = [];
  const errors = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const value = JSON.parse(line);
      if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
      messages.push({ line: i + 1, msg: value });
    } catch (e) {
      errors.push(`line ${i + 1}: invalid JSON (${e.message})`);
    }
  });
  return { messages, errors };
}

/** Pure gate decision, mirroring CLAUDE.md Phase 5. */
export function gateDecision(reviews, securityResults) {
  const blockedBy = [];
  for (const r of reviews) if (r.verdict === "blocked") blockedBy.push(`reviewer-${r.reviewer_for}`);
  for (const s of securityResults) {
    if (s.verdict === "blocked" || (typeof s.risk_score === "number" && s.risk_score >= SECURITY_BLOCK_THRESHOLD)) {
      blockedBy.push("security-reviewer");
    }
  }
  return { ship: blockedBy.length === 0, blockedBy };
}

/** Validate parsed messages against the protocol schemas. Returns error strings. */
export function validateMessages(entries, schemas) {
  const errors = [];
  const at = (line, m) => errors.push(`line ${line}: ${m}`);
  if (entries.length === 0) return errors;

  // Per-message shape.
  for (const { line, msg } of entries) {
    const schema = schemas[msg.type];
    if (!schema) {
      at(line, `unknown message type "${msg.type}"`);
      continue;
    }
    for (const key of Object.keys(schema)) if (!(key in msg)) at(line, `${msg.type} is missing "${key}"`);
    if ("verdict" in msg && !ENUMS.verdict.includes(msg.verdict)) at(line, `invalid verdict "${msg.verdict}"`);
    if ("self_assessment" in msg && !ENUMS.self_assessment.includes(msg.self_assessment)) {
      at(line, `invalid self_assessment "${msg.self_assessment}"`);
    }
    for (const item of [...(msg.issues ?? []), ...(msg.findings ?? [])]) {
      if (!ENUMS.severity.includes(item.severity)) at(line, `invalid severity "${item.severity}"`);
    }
    if (msg.type === "SECURITY_RESULT" && (typeof msg.risk_score !== "number" || msg.risk_score < 0 || msg.risk_score > 10)) {
      at(line, "risk_score must be a number from 0 to 10");
    }
  }

  // Sequencing and cross-message invariants.
  const sessions = new Set(entries.map((e) => e.msg.session));
  if (sessions.size > 1) errors.push(`file mixes ${sessions.size} sessions: ${[...sessions].join(", ")}`);

  const first = entries[0];
  if (first.msg.type !== "FEATURE_PLAN") {
    at(first.line, `first message must be FEATURE_PLAN, got ${first.msg.type}`);
    return errors;
  }
  const assigned = new Set(first.msg.agents_needed ?? []);
  const implemented = new Set();
  const reviewed = new Set();
  const reviews = [];
  const security = [];
  let reviewStarted = false;

  for (const { line, msg } of entries.slice(1)) {
    switch (msg.type) {
      case "FEATURE_PLAN":
        at(line, "FEATURE_PLAN may only appear once, as the first message");
        break;
      case "IMPLEMENTATION_DONE":
        if (!assigned.has(msg.agent)) at(line, `IMPLEMENTATION_DONE from unassigned agent "${msg.agent}"`);
        if (reviewStarted) at(line, `IMPLEMENTATION_DONE from "${msg.agent}" after reviews started`);
        implemented.add(msg.agent);
        break;
      case "REVIEW_RESULT":
      case "SECURITY_RESULT":
        if (!reviewStarted) {
          reviewStarted = true;
          const missing = [...assigned].filter((a) => !implemented.has(a));
          if (missing.length) at(line, `review started before experts reported: ${missing.join(", ")}`);
        }
        if (msg.type === "REVIEW_RESULT") {
          if (!assigned.has(msg.reviewer_for)) at(line, `REVIEW_RESULT for unassigned agent "${msg.reviewer_for}"`);
          reviewed.add(msg.reviewer_for);
          reviews.push(msg);
        } else {
          security.push(msg);
        }
        break;
      case "SHIP_DONE": {
        const unreviewed = [...assigned].filter((a) => !reviewed.has(a));
        if (unreviewed.length) at(line, `SHIP_DONE before review of: ${unreviewed.join(", ")}`);
        const gate = gateDecision(reviews, security);
        if (!gate.ship) at(line, `SHIP_DONE despite a closed gate (blocked by ${gate.blockedBy.join(", ")})`);
        break;
      }
    }
  }
  return errors;
}

export function validateFile(path, root) {
  const { schemas } = loadProtocol(root);
  const { messages, errors } = parseJsonl(readFileSync(path, "utf8"));
  return { count: messages.length, errors: [...errors, ...validateMessages(messages, schemas)] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(join(fileURLToPath(import.meta.url), "..", ".."));
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("usage: node scripts/validate-messages.mjs <messages.jsonl> [...]");
    process.exit(2);
  }
  let failed = false;
  for (const f of files) {
    const { count, errors } = validateFile(resolve(f), root);
    if (errors.length) {
      failed = true;
      for (const e of errors) console.error(`✗ ${f}: ${e}`);
    } else {
      console.log(`✓ ${f}: ${count} messages conform to the protocol`);
    }
  }
  process.exit(failed ? 1 : 0);
}
