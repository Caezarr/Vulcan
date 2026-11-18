import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../scripts/lib/frontmatter.mjs";
import { lintDefinition, lintFeatureSpec, validateRepo } from "../scripts/validate-definitions.mjs";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const TYPES = ["FEATURE_PLAN", "IMPLEMENTATION_DONE"];

describe("frontmatter parser", () => {
  it("handles quotes, comments, lists, booleans, numbers and nested maps", () => {
    const { data, body } = parseFrontmatter(
      '---\ntitle: "A: b"\nstatus: draft   # draft | ready\nphase: 2\nflag: true\nskip: []\nlist: [a, "b"]\nstack:\n  db: sqlite  # x\n---\n# Body\n',
    );
    assert.deepEqual(data, {
      title: "A: b",
      status: "draft",
      phase: 2,
      flag: true,
      skip: [],
      list: ["a", "b"],
      stack: { db: "sqlite" },
    });
    assert.equal(body, "# Body\n");
  });

  it("returns null data when there is no frontmatter", () => {
    assert.equal(parseFrontmatter("# Just a heading\n").data, null);
  });
});

describe("agent / skill lint", () => {
  const agent = (fm, body = '# X\n\n```json\n{ "type": "IMPLEMENTATION_DONE" }\n```\n') => `---\n${fm}\n---\n${body}`;

  it("accepts a well-formed expert", () => {
    const source = agent('name: backend\nkind: agent\ndescription: "d"\nphase: 2\nemits: [IMPLEMENTATION_DONE]');
    assert.deepEqual(lintDefinition({ file: "agents/backend.md", kind: "agent", source, messageTypes: TYPES }), []);
  });

  it("reports missing fields, name mismatch, bad phase and unknown message types", () => {
    const source = agent("name: other\nkind: agent\nphase: 3\nemits: [NOPE]");
    const errors = lintDefinition({ file: "agents/backend.md", kind: "agent", source, messageTypes: TYPES }).join("\n");
    assert.match(errors, /missing required field "description"/);
    assert.match(errors, /name "other" must match/);
    assert.match(errors, /phase must be one of/);
    assert.match(errors, /"NOPE", which is not in CLAUDE.md/);
  });

  it("requires the output contract to show each declared message type", () => {
    const source = agent('name: architect\nkind: agent\ndescription: "d"\nphase: 1\nemits: [FEATURE_PLAN]', "# Architect\n");
    const errors = lintDefinition({ file: "agents/architect.md", kind: "agent", source, messageTypes: TYPES });
    assert.match(errors.join(), /never shows "type": "FEATURE_PLAN"/);
  });

  it("reports a definition with no frontmatter", () => {
    const errors = lintDefinition({ file: "skills/x.md", kind: "skill", source: "# X\n", messageTypes: TYPES });
    assert.deepEqual(errors, ["skills/x.md: missing frontmatter block"]);
  });
});

describe("feature spec lint", () => {
  const spec = (over = "") =>
    `---\nfeature: dark-mode\ntitle: "Dark mode"\nstatus: ready\npriority: high\ntarget_dir: ~/code/app\nstack:\n  frontend: react\nskip_agents: [db]\nrequires_security_review: true\n${over}---\n# Spec\n`;

  it("accepts a valid spec", () => {
    assert.deepEqual(lintFeatureSpec({ file: "f.md", source: spec(), isTemplate: false }), []);
  });

  it("rejects bad enums, unknown agents and machine-specific paths", () => {
    const source = spec()
      .replace("status: ready", "status: done")
      .replace("skip_agents: [db]", "skip_agents: [devops]")
      .replace("target_dir: ~/code/app", "target_dir: /Users/someone/app")
      .replace("requires_security_review: true", "requires_security_review: maybe");
    const errors = lintFeatureSpec({ file: "f.md", source, isTemplate: false }).join("\n");
    assert.match(errors, /status must be one of/);
    assert.match(errors, /unknown agent "devops"/);
    assert.match(errors, /machine-specific absolute path/);
    assert.match(errors, /requires_security_review must be true or false/);
  });
});

describe("repository", () => {
  it("every agent, skill and feature spec in the repo is valid", () => {
    const { errors, counts } = validateRepo(ROOT);
    assert.deepEqual(errors, []);
    assert.equal(counts.agents, 8);
    assert.equal(counts.messageTypes, 5);
  });
});
