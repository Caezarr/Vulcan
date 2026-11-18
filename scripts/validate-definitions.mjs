#!/usr/bin/env node
// Validates the markdown definitions Vulcan runs on:
//   agents/*.md   frontmatter: name, kind, description, phase, emits
//   skills/*.md   frontmatter: name, kind, description
//   feature specs templates/feature.md, features/*.md, examples/*/feature.md
// and cross-checks them against the message protocol in CLAUDE.md.
//
// Usage: node scripts/validate-definitions.mjs [repoRoot]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./lib/frontmatter.mjs";
import { EXPERTS, loadProtocol } from "./lib/protocol.mjs";

const KEBAB = /^[a-z][a-z0-9-]*$/;
const PHASES = [1, 2, 4, 6]; // phases that spawn agents (see CLAUDE.md)
const FEATURE_STATUS = ["draft", "ready", "in-progress", "shipped"];
const FEATURE_PRIORITY = ["low", "medium", "high", "critical"];
const STACK_KEYS = ["backend", "frontend", "api", "db"];

const mdFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".md") && f !== "README.md")
        .sort()
        .map((f) => join(dir, f))
    : [];

export function featureSpecFiles(root) {
  const files = [join(root, "templates", "feature.md"), ...mdFiles(join(root, "features"))];
  const examples = join(root, "examples");
  if (existsSync(examples)) {
    for (const d of readdirSync(examples, { withFileTypes: true })) {
      const f = join(examples, d.name, "feature.md");
      if (d.isDirectory() && existsSync(f)) files.push(f);
    }
  }
  return files.filter((f) => existsSync(f));
}

/** Lint one agent or skill definition. Returns error strings. */
export function lintDefinition({ file, kind, source, messageTypes }) {
  const errors = [];
  const err = (m) => errors.push(`${file}: ${m}`);
  let parsed;
  try {
    parsed = parseFrontmatter(source);
  } catch (e) {
    return [`${file}: ${e.message}`];
  }
  const { data: fm, body } = parsed;
  if (!fm) return [`${file}: missing frontmatter block`];

  const stem = basename(file, ".md");
  const required = kind === "agent" ? ["name", "kind", "description", "phase", "emits"] : ["name", "kind", "description"];
  for (const k of required) if (fm[k] === undefined || fm[k] === "") err(`missing required field "${k}"`);
  if (fm.name !== undefined && fm.name !== stem) err(`name "${fm.name}" must match file name "${stem}"`);
  if (!KEBAB.test(stem)) err("file name must be lowercase kebab-case");
  if (fm.kind !== undefined && fm.kind !== kind) err(`kind must be "${kind}"`);
  if (typeof fm.description === "string" && fm.description.length > 200) err("description longer than 200 chars");
  if (!/^#\s+\S/m.test(body)) err("body must start with a top-level heading");

  if (kind === "agent") {
    if (fm.phase !== undefined && !PHASES.includes(fm.phase)) err(`phase must be one of ${PHASES.join(", ")}`);
    const emits = Array.isArray(fm.emits) ? fm.emits : [];
    if (fm.emits !== undefined && !Array.isArray(fm.emits)) err("emits must be a list");
    for (const t of emits) {
      if (!messageTypes.includes(t)) err(`emits "${t}", which is not in CLAUDE.md's Message Protocol`);
      else if (!body.includes(`"${t}"`)) err(`declares ${t} but its output contract never shows "type": "${t}"`);
    }
  }
  return errors;
}

/** Lint a feature spec's frontmatter. */
export function lintFeatureSpec({ file, source, isTemplate }) {
  const errors = [];
  const err = (m) => errors.push(`${file}: ${m}`);
  let fm;
  try {
    fm = parseFrontmatter(source).data;
  } catch (e) {
    return [`${file}: ${e.message}`];
  }
  if (!fm) return [`${file}: missing frontmatter block`];
  for (const k of ["feature", "title", "status", "priority", "target_dir", "stack", "skip_agents", "requires_security_review"]) {
    if (fm[k] === undefined) err(`missing required field "${k}"`);
  }
  if (typeof fm.feature === "string" && !KEBAB.test(fm.feature)) err(`feature "${fm.feature}" must be kebab-case`);
  if (fm.status !== undefined && !FEATURE_STATUS.includes(fm.status)) err(`status must be one of ${FEATURE_STATUS.join(" | ")}`);
  if (fm.priority !== undefined && !FEATURE_PRIORITY.includes(fm.priority)) err(`priority must be one of ${FEATURE_PRIORITY.join(" | ")}`);
  if (fm.stack !== undefined) {
    if (typeof fm.stack !== "object" || Array.isArray(fm.stack)) err("stack must be a map");
    else for (const k of Object.keys(fm.stack)) if (!STACK_KEYS.includes(k)) err(`stack has unknown domain "${k}"`);
  }
  if (fm.skip_agents !== undefined) {
    if (!Array.isArray(fm.skip_agents)) err("skip_agents must be a list");
    else for (const a of fm.skip_agents) if (!EXPERTS.includes(a)) err(`skip_agents has unknown agent "${a}"`);
  }
  if (fm.requires_security_review !== undefined && typeof fm.requires_security_review !== "boolean") {
    err("requires_security_review must be true or false");
  }
  if (!isTemplate && typeof fm.target_dir === "string" && /^\/(Users|home)\//.test(fm.target_dir)) {
    err("target_dir must not be a machine-specific absolute path in a committed spec");
  }
  return errors;
}

/** Validate the whole repository. */
export function validateRepo(root) {
  const { markdown, schemas } = loadProtocol(root);
  const messageTypes = Object.keys(schemas);
  const errors = [];
  const agents = {};

  for (const file of mdFiles(join(root, "agents"))) {
    const source = readFileSync(file, "utf8");
    const rel = relative(root, file);
    errors.push(...lintDefinition({ file: rel, kind: "agent", source, messageTypes }));
    agents[basename(file, ".md")] = parseFrontmatter(source).data ?? {};
  }
  for (const file of mdFiles(join(root, "skills"))) {
    const rel = relative(root, file);
    errors.push(...lintDefinition({ file: rel, kind: "skill", source: readFileSync(file, "utf8"), messageTypes }));
  }

  // Cross-checks against CLAUDE.md.
  for (const expert of EXPERTS) {
    if (!agents[expert]) errors.push(`agents/${expert}.md: missing definition for expert "${expert}"`);
    else if (agents[expert].phase !== 2) errors.push(`agents/${expert}.md: experts run in phase 2`);
  }
  for (const m of markdown.matchAll(/agents\/([a-z-]+)\.md/g)) {
    if (!agents[m[1]]) errors.push(`CLAUDE.md references agents/${m[1]}.md, which does not exist`);
  }
  for (const t of messageTypes) {
    if (!Object.values(agents).some((a) => Array.isArray(a.emits) && a.emits.includes(t))) {
      errors.push(`CLAUDE.md: message type ${t} is not emitted by any agent`);
    }
  }

  const specs = featureSpecFiles(root);
  for (const file of specs) {
    const rel = relative(root, file);
    errors.push(...lintFeatureSpec({ file: rel, source: readFileSync(file, "utf8"), isTemplate: rel === join("templates", "feature.md") }));
  }

  return { errors, counts: { agents: Object.keys(agents).length, skills: mdFiles(join(root, "skills")).length, specs: specs.length, messageTypes: messageTypes.length } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(fileURLToPath(import.meta.url), "..", ".."));
  const { errors, counts } = validateRepo(root);
  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`);
    console.error(`\n${errors.length} problem(s) found.`);
    process.exit(1);
  }
  console.log(
    `✓ ${counts.agents} agents, ${counts.skills} skill(s), ${counts.specs} feature spec(s) valid against ${counts.messageTypes} protocol message types`,
  );
}
