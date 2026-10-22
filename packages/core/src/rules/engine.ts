import type { Evidence, Finding, GraphModel, Severity } from "../ir/types.js";
import { GlobSet } from "../util/glob.js";
import { shortHash } from "../util/hash.js";
import { parseYamlSubset } from "./yaml.js";

export class RulesError extends Error {}

export interface Layer {
  name: string;
  paths: string[];
}

export type RuleSpec =
  | { id: string; type: "forbid-dependency"; from: string; to: string; severity: Severity; description: string | null }
  | { id: string; type: "allow-only"; from: string; allowed: string[]; severity: Severity; description: string | null }
  | { id: string; type: "no-cycles"; scope: "file" | "module"; severity: Severity; description: string | null }
  | { id: string; type: "forbid-external"; from: string; packages: string[]; severity: Severity; description: string | null }
  | { id: string; type: "limit"; metric: "file-code-lines" | "function-complexity" | "module-fan-out"; max: number; severity: Severity; description: string | null };

export interface RuleSet {
  layers: Layer[];
  rules: RuleSpec[];
}

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

const asStringList = (v: unknown, where: string): string[] => {
  if (typeof v === "string") return [v];
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
  throw new RulesError(`${where} must be a string or list of strings`);
};

/** Parses and validates a rules file (YAML subset or JSON). Throws RulesError with a precise message. */
export function parseRules(text: string, fileName: string): RuleSet {
  let doc: unknown;
  try {
    doc = fileName.endsWith(".json") ? JSON.parse(text) : parseYamlSubset(text);
  } catch (e) {
    throw new RulesError(`Cannot parse ${fileName}: ${(e as Error).message}`);
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) throw new RulesError("Rules file must be a mapping");
  const root = doc as Record<string, unknown>;
  if (root.version !== 1) throw new RulesError("Rules file must declare version: 1");
  for (const k of Object.keys(root)) if (!["version", "layers", "rules"].includes(k)) throw new RulesError(`Unknown top-level key: ${k}`);

  const layers: Layer[] = [];
  for (const [i, raw] of ((root.layers as unknown[]) ?? []).entries()) {
    const l = raw as Record<string, unknown>;
    if (!l || typeof l.name !== "string") throw new RulesError(`layers[${i}] needs a name`);
    layers.push({ name: l.name, paths: asStringList(l.paths, `layers[${i}].paths`) });
  }
  const layerNames = new Set(layers.map((l) => l.name));
  if (layerNames.size !== layers.length) throw new RulesError("Layer names must be unique");

  const rules: RuleSpec[] = [];
  const ids = new Set<string>();
  const requireLayer = (name: unknown, where: string): string => {
    if (typeof name !== "string" || !layerNames.has(name)) throw new RulesError(`${where} references unknown layer ${JSON.stringify(name)}`);
    return name;
  };
  for (const [i, raw] of ((root.rules as unknown[]) ?? []).entries()) {
    const r = raw as Record<string, unknown>;
    const where = `rules[${i}]`;
    if (!r || typeof r.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(r.id)) throw new RulesError(`${where}.id must be lowercase letters, digits and dashes`);
    if (ids.has(r.id)) throw new RulesError(`Duplicate rule id ${r.id}`);
    ids.add(r.id);
    const severity = (r.severity ?? "medium") as Severity;
    if (!SEVERITIES.includes(severity)) throw new RulesError(`${where}.severity must be one of ${SEVERITIES.join(", ")}`);
    const description = typeof r.description === "string" ? r.description : null;
    const base = { id: r.id, severity, description };
    const forbid = r.forbid as Record<string, unknown> | string | undefined;
    if (forbid === "cycles") {
      const scope = (r.scope ?? "modules") === "files" ? "file" : "module";
      if (r.scope !== undefined && r.scope !== "files" && r.scope !== "modules") throw new RulesError(`${where}.scope must be files or modules`);
      rules.push({ ...base, type: "no-cycles", scope });
    } else if (forbid && typeof forbid === "object" && "from" in forbid && "to" in forbid) {
      rules.push({ ...base, type: "forbid-dependency", from: requireLayer(forbid.from, `${where}.forbid.from`), to: requireLayer(forbid.to, `${where}.forbid.to`) });
    } else if (forbid && typeof forbid === "object" && "from" in forbid && "external" in forbid) {
      rules.push({ ...base, type: "forbid-external", from: requireLayer(forbid.from, `${where}.forbid.from`), packages: asStringList(forbid.external, `${where}.forbid.external`) });
    } else if (r.allowOnly && typeof r.allowOnly === "object") {
      const a = r.allowOnly as Record<string, unknown>;
      rules.push({ ...base, type: "allow-only", from: requireLayer(a.from, `${where}.allowOnly.from`), allowed: asStringList(a.to, `${where}.allowOnly.to`).map((n) => requireLayer(n, `${where}.allowOnly.to`)) });
    } else if (r.limit && typeof r.limit === "object") {
      const l = r.limit as Record<string, unknown>;
      const metric = l.metric;
      if (metric !== "file-code-lines" && metric !== "function-complexity" && metric !== "module-fan-out") throw new RulesError(`${where}.limit.metric is not supported`);
      if (typeof l.max !== "number" || !(l.max > 0)) throw new RulesError(`${where}.limit.max must be a positive number`);
      rules.push({ ...base, type: "limit", metric, max: l.max });
    } else {
      throw new RulesError(`${where} must define forbid, allowOnly or limit`);
    }
  }
  return { layers, rules };
}

export interface RuleInputs {
  graph: GraphModel;
  externalsByFile: Map<string, { pkg: string; line: number }[]>;
  fileCodeLines: Map<string, number>;
  functions: { path: string; name: string; line: number; complexity: number }[];
}

export interface Baseline {
  accepted: string[];
}

export function parseBaseline(text: string): Baseline {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new RulesError("Baseline file is not valid JSON");
  }
  const accepted = (doc as { accepted?: unknown })?.accepted;
  if (!Array.isArray(accepted) || !accepted.every((a) => typeof a === "string")) throw new RulesError("Baseline must be { \"accepted\": [finding ids] }");
  return { accepted: accepted as string[] };
}

function ruleFinding(rule: RuleSpec, key: string, title: string, explanation: string, evidence: Evidence[], locations: Finding["locations"], remediation: string): Finding {
  return {
    id: `RL-RULE-${rule.id.toUpperCase()}-${shortHash(`${rule.id}|${key}`, 8)}`,
    title, category: "architecture", ruleId: `rule.${rule.id}`, severity: rule.severity, confidence: "high", origin: "observed",
    classification: null, explanation, evidence, locations, remediation,
    limitations: ["Only statically resolved imports are evaluated. Dynamic imports with non-literal arguments are not."],
    tags: ["rule", rule.type],
  };
}

export function evaluateRules(set: RuleSet, inp: RuleInputs): Finding[] {
  const layerSets = new Map(set.layers.map((l) => [l.name, new GlobSet(l.paths)]));
  const layerOf = (path: string): string | null => {
    for (const [name, gs] of layerSets) if (gs.matches(path)) return name;
    return null;
  };
  const idToPath = new Map(inp.graph.nodes.map((n) => [n.id, n.path]));
  const out: Finding[] = [];
  for (const rule of set.rules) {
    if (rule.type === "forbid-dependency" || rule.type === "allow-only") {
      for (const e of inp.graph.edges) {
        const from = idToPath.get(e.from) as string;
        const to = idToPath.get(e.to) as string;
        const lf = layerOf(from);
        const lt = layerOf(to);
        if (lf !== rule.from || lt === null || lt === lf) continue;
        const violates = rule.type === "forbid-dependency" ? lt === rule.to : !rule.allowed.includes(lt);
        if (!violates) continue;
        const line = e.occurrences[0]?.line ?? null;
        out.push(ruleFinding(rule, `${from}>${to}`,
          rule.type === "forbid-dependency" ? `Layer ${rule.from} depends on ${rule.to}` : `Layer ${rule.from} depends on disallowed layer ${lt}`,
          `${from} imports ${to}. ${rule.description ?? `Rule ${rule.id} does not allow ${rule.from} to depend on ${lt}.`}`,
          [{ kind: "graph-path", refs: [from, to], note: e.occurrences[0] ? `import ${JSON.stringify(e.occurrences[0].specifier)} at line ${e.occurrences[0].line}` : null }],
          [{ path: from, startLine: line, endLine: line }],
          `Remove or invert the dependency from ${from} to ${to}, or move the shared code to a layer both may use.`));
      }
    } else if (rule.type === "no-cycles") {
      for (const c of inp.graph.cycles.filter((x) => x.scope === rule.scope)) {
        out.push(ruleFinding(rule, c.members.join("|"), `Circular dependency among ${c.size} ${rule.scope === "file" ? "files" : "modules"}`,
          `${c.members.join(", ")} depend on each other in a cycle.${c.typeOnly ? " The cycle consists of type-only imports." : ""}`,
          [{ kind: "graph-path", refs: [...c.members, c.members[0] as string], note: null }],
          c.members.slice(0, 5).map((p) => ({ path: p, startLine: null, endLine: null })),
          "Break the cycle by extracting shared code into a module that both sides depend on."));
      }
    } else if (rule.type === "forbid-external") {
      for (const [path, list] of inp.externalsByFile) {
        if (layerOf(path) !== rule.from) continue;
        const pkgSet = new GlobSet(rule.packages);
        for (const ext of list) {
          if (!pkgSet.matches(ext.pkg)) continue;
          out.push(ruleFinding(rule, `${path}|${ext.pkg}`, `Layer ${rule.from} imports forbidden package ${ext.pkg}`,
            `${path} imports ${ext.pkg}. ${rule.description ?? ""}`.trim(),
            [{ kind: "location", refs: [path], note: `package ${ext.pkg}` }],
            [{ path, startLine: ext.line, endLine: ext.line }],
            `Remove the ${ext.pkg} import from ${rule.from}, or depend on an abstraction owned by an outer layer.`));
        }
      }
    } else {
      if (rule.metric === "file-code-lines") {
        for (const [path, lines] of inp.fileCodeLines) if (lines > rule.max) out.push(ruleFinding(rule, path, `File exceeds ${rule.max} code lines`, `${path} has ${lines} code lines.`, [{ kind: "metric", refs: [path], note: `codeLines=${lines}` }], [{ path, startLine: null, endLine: null }], "Split the file by responsibility."));
      } else if (rule.metric === "function-complexity") {
        for (const f of inp.functions) if (f.complexity > rule.max) out.push(ruleFinding(rule, `${f.path}:${f.name}:${f.line}`, `Function ${f.name} exceeds complexity ${rule.max}`, `${f.name} in ${f.path} has complexity ${f.complexity}.`, [{ kind: "metric", refs: [f.path], note: `complexity=${f.complexity}` }], [{ path: f.path, startLine: f.line, endLine: null }], "Extract branches into smaller functions."));
      } else {
        for (const m of inp.graph.modules) if ((m.fanOut ?? 0) > rule.max) out.push(ruleFinding(rule, m.path, `Module ${m.path} depends on more than ${rule.max} modules`, `${m.path} depends on ${m.fanOut} modules.`, [{ kind: "metric", refs: [m.path], note: `fanOut=${m.fanOut}` }], [{ path: m.path, startLine: null, endLine: null }], "Introduce a facade or split the module."));
      }
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function applyBaseline(findings: Finding[], baseline: Baseline): { kept: Finding[]; suppressed: number } {
  const accepted = new Set(baseline.accepted);
  const kept = findings.filter((f) => !accepted.has(f.id));
  return { kept, suppressed: findings.length - kept.length };
}
