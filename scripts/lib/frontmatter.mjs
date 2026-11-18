// Minimal frontmatter reader for Vulcan markdown files. No dependencies.
// Supports the subset the repo uses: `key: value`, quoted strings, `# comments`,
// inline lists `[a, "b"]`, booleans, integers, and one level of nested maps.

function scalar(raw) {
  let v = raw.trim();
  if (!v.startsWith('"') && !v.startsWith("'")) v = v.replace(/\s+#.*$/, "").trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    return inner ? inner.split(",").map((x) => scalar(x)) : [];
  }
  if (/^"(.*)"$/.test(v) || /^'(.*)'$/.test(v)) return v.slice(1, -1);
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

/** @returns {{ data: Record<string, unknown> | null, body: string }} */
export function parseFrontmatter(source) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!m) return { data: null, body: source };
  const data = {};
  let parent = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const nested = /^\s+/.test(line);
    const idx = line.indexOf(":");
    if (idx < 0) throw new Error(`malformed frontmatter line: "${line}"`);
    const key = line.slice(0, idx).trim();
    const rest = line.slice(idx + 1);
    if (nested) {
      if (!parent) throw new Error(`indented key "${key}" without a parent`);
      data[parent][key] = scalar(rest);
      continue;
    }
    if (rest.trim() === "" || rest.trim().startsWith("#")) {
      data[key] = {};
      parent = key;
    } else {
      data[key] = scalar(rest);
      parent = null;
    }
  }
  return { data, body: source.slice(m[0].length) };
}
