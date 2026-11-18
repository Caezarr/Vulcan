import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProtocol } from "../scripts/lib/protocol.mjs";
import { gateDecision, parseJsonl, validateFile, validateMessages } from "../scripts/validate-messages.mjs";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const { schemas } = loadProtocol(ROOT);

// Build a message from the CLAUDE.md example so fixtures always match the contract.
const make = (type, over = {}) => ({ ...structuredClone(schemas[type]), session: "s1", feature: "f", ...over });
const plan = (agents = ["backend", "frontend"]) => make("FEATURE_PLAN", { agents_needed: agents });
const impl = (agent) => make("IMPLEMENTATION_DONE", { agent, self_assessment: "pass" });
const review = (agent, verdict = "approved") => make("REVIEW_RESULT", { reviewer_for: agent, verdict, issues: [] });
const sec = (risk = 2, verdict = "approved") => make("SECURITY_RESULT", { risk_score: risk, verdict, findings: [] });
const ship = () => make("SHIP_DONE");
const run = (...msgs) => validateMessages(msgs.map((msg, i) => ({ line: i + 1, msg })), schemas);

describe("protocol extraction from CLAUDE.md", () => {
  it("finds all five message types with their example fields", () => {
    assert.deepEqual(Object.keys(schemas), [
      "FEATURE_PLAN",
      "IMPLEMENTATION_DONE",
      "REVIEW_RESULT",
      "SECURITY_RESULT",
      "SHIP_DONE",
    ]);
    assert.ok("agents_needed" in schemas.FEATURE_PLAN);
    assert.ok("risk_score" in schemas.SECURITY_RESULT);
  });
});

describe("gate decision (Phase 5)", () => {
  it("ships when every reviewer approves and risk < 7", () => {
    assert.deepEqual(gateDecision([{ reviewer_for: "api", verdict: "approved_with_notes" }], [{ verdict: "approved", risk_score: 6 }]), {
      ship: true,
      blockedBy: [],
    });
  });
  it("blocks on any reviewer verdict blocked", () => {
    assert.deepEqual(gateDecision([{ reviewer_for: "db", verdict: "blocked" }], []).blockedBy, ["reviewer-db"]);
  });
  it("blocks on security verdict blocked", () => {
    assert.equal(gateDecision([], [{ verdict: "blocked", risk_score: 1 }]).ship, false);
  });
  it("blocks on risk score ≥ 7 even if the verdict is approved", () => {
    assert.equal(gateDecision([], [{ verdict: "approved", risk_score: 7 }]).ship, false);
  });
});

describe("audit trail validation", () => {
  it("accepts a complete, gated run", () => {
    assert.deepEqual(run(plan(), impl("backend"), impl("frontend"), review("backend"), review("frontend"), sec(), ship()), []);
  });

  it("accepts a run that stopped at the gate (no SHIP_DONE)", () => {
    assert.deepEqual(run(plan(), impl("backend"), impl("frontend"), review("backend", "blocked"), review("frontend")), []);
  });

  it("flags SHIP_DONE after a blocked review", () => {
    const errors = run(plan(), impl("backend"), impl("frontend"), review("backend", "blocked"), review("frontend"), ship());
    assert.match(errors.join(), /SHIP_DONE despite a closed gate \(blocked by reviewer-backend\)/);
  });

  it("flags SHIP_DONE after a high security risk", () => {
    const errors = run(plan(), impl("backend"), impl("frontend"), review("backend"), review("frontend"), sec(8), ship());
    assert.match(errors.join(), /blocked by security-reviewer/);
  });

  it("flags SHIP_DONE before every expert was reviewed", () => {
    const errors = run(plan(), impl("backend"), impl("frontend"), review("backend"), ship());
    assert.match(errors.join(), /SHIP_DONE before review of: frontend/);
  });

  it("flags reviews that start before all experts reported", () => {
    const errors = run(plan(), impl("backend"), review("backend"), impl("frontend"));
    assert.match(errors.join("\n"), /review started before experts reported: frontend/);
    assert.match(errors.join("\n"), /after reviews started/);
  });

  it("flags work from agents the architect did not assign", () => {
    const errors = run(plan(["backend"]), impl("backend"), impl("db"));
    assert.match(errors.join(), /unassigned agent "db"/);
  });

  it("flags missing fields, bad enums, unknown types and mixed sessions", () => {
    const bad = impl("backend");
    delete bad.files_created;
    bad.self_assessment = "great";
    const errors = run(plan(["backend"]), bad, { type: "HELLO", session: "s2" }).join("\n");
    assert.match(errors, /missing "files_created"/);
    assert.match(errors, /invalid self_assessment "great"/);
    assert.match(errors, /unknown message type "HELLO"/);
    assert.match(errors, /mixes 2 sessions/);
  });

  it("requires the trail to start with FEATURE_PLAN", () => {
    assert.match(run(impl("backend")).join(), /first message must be FEATURE_PLAN/);
  });

  it("reports malformed JSON lines with their line number", () => {
    const { messages, errors } = parseJsonl('{"type":"FEATURE_PLAN"}\n\nnot json\n[1]\n');
    assert.equal(messages.length, 1);
    assert.equal(errors.length, 2);
    assert.match(errors[0], /^line 3:/);
  });
});

describe("sample run", () => {
  it("examples/conductor-phase1-run/messages.jsonl conforms to the protocol", () => {
    const { count, errors } = validateFile(join(ROOT, "examples", "conductor-phase1-run", "messages.jsonl"), ROOT);
    assert.deepEqual(errors, []);
    assert.equal(count, 13);
  });
});
