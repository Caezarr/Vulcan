// Reads the message protocol straight out of CLAUDE.md so validators never
// drift from the contract the orchestrator actually follows.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Expert agents the Architect can assign work to (Phase 2). */
export const EXPERTS = ["backend", "frontend", "api", "db"];

/** Allowed values for enum-like message fields (from CLAUDE.md). */
export const ENUMS = {
  verdict: ["approved", "approved_with_notes", "blocked"],
  self_assessment: ["pass", "warn", "fail"],
  severity: ["critical", "major", "minor"],
};

/** Security risk score at or above which the gate blocks the ship. */
export const SECURITY_BLOCK_THRESHOLD = 7;

/**
 * Parse `## Message Protocol` in CLAUDE.md into { TYPE: exampleObject }.
 * Each `### TYPE` heading is followed by a ```json block with an example.
 */
export function loadProtocol(root) {
  const md = readFileSync(join(root, "CLAUDE.md"), "utf8");
  const start = md.indexOf("## Message Protocol");
  if (start < 0) throw new Error("CLAUDE.md has no '## Message Protocol' section");
  const end = md.indexOf("\n## ", start + 1);
  const section = md.slice(start, end < 0 ? undefined : end);
  const schemas = {};
  for (const m of section.matchAll(/^### ([A-Z_]+)\s*\n+```json\n([\s\S]*?)\n```/gm)) {
    schemas[m[1]] = JSON.parse(m[2]);
  }
  return { markdown: md, schemas };
}
