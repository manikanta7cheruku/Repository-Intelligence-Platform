import type { Workspace } from "../acquire/types.js";
import { parseJsonSafe } from "../detect/manifests.js";
import type { DependencySecuritySummary, Finding, Severity } from "../ir/types.js";
import { shortHash } from "../util/hash.js";
import { basename } from "../util/paths.js";
import { nearestFix } from "../util/semver.js";

export interface PackageRef {
  ecosystem: "npm" | "PyPI";
  name: string;
  version: string;
  source: string;
  /** True when the lockfile marks the package as development-only. Null when the lockfile does not say. */
  dev: boolean | null;
}

type LockParser = (text: string, source: string) => PackageRef[];

const npmLock: LockParser = (text, source) => {
  const doc = parseJsonSafe<{
    packages?: Record<
      string,
      { version?: string; link?: boolean; dev?: boolean; devOptional?: boolean }
    >;
    dependencies?: Record<string, unknown>;
  }>(text);
  const out: PackageRef[] = [];
  if (!doc) return out;
  if (doc.packages) {
    for (const [key, v] of Object.entries(doc.packages)) {
      if (key === "" || !v?.version || v.link) continue;
      const idx = key.lastIndexOf("node_modules/");
      if (idx === -1) continue;
      out.push({
        ecosystem: "npm",
        name: key.slice(idx + "node_modules/".length),
        version: v.version,
        source,
        dev: v.dev === true || v.devOptional === true,
      });
    }
  } else if (doc.dependencies) {
    const walk = (deps: Record<string, unknown>): void => {
      for (const [name, raw] of Object.entries(deps)) {
        const d = raw as {
          version?: string;
          dev?: boolean;
          dependencies?: Record<string, unknown>;
        };
        if (d.version && /^\d/.test(d.version))
          out.push({ ecosystem: "npm", name, version: d.version, source, dev: d.dev === true });
        if (d.dependencies) walk(d.dependencies);
      }
    };
    walk(doc.dependencies);
  }
  return out;
};

const yarnLock: LockParser = (text, source) => {
  const out: PackageRef[] = [];
  let names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line === "" || line.startsWith("#")) continue;
    if (!line.startsWith(" ") && line.endsWith(":")) {
      names = line
        .slice(0, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .map((s) => s.slice(0, s.lastIndexOf("@")))
        .filter(Boolean);
      continue;
    }
    const m = /^\s+version:?\s+"?([^"\s]+)"?/.exec(line);
    if (m && names.length > 0) {
      for (const n of new Set(names))
        out.push({ ecosystem: "npm", name: n, version: m[1] as string, source, dev: null });
      names = [];
    }
  }
  return out;
};

const pnpmLock: LockParser = (text, source) => {
  const out: PackageRef[] = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (/^\S/.test(line)) {
      if (inPackages) inPackages = false;
      continue;
    }
    if (!inPackages) continue;
    let m = /^ {2}'?\/?((?:@[^/@'\s]+\/)?[^@(':\s/]+)@([^(':\s]+)/.exec(line);
    if (m) {
      out.push({
        ecosystem: "npm",
        name: m[1] as string,
        version: m[2] as string,
        source,
        dev: null,
      });
      continue;
    }
    m = /^ {2}'?\/((?:@[^/]+\/)?[^/]+)\/(\d[^/:(_']*)/.exec(line);
    if (m)
      out.push({
        ecosystem: "npm",
        name: m[1] as string,
        version: m[2] as string,
        source,
        dev: null,
      });
  }
  return out;
};

const requirements: LockParser = (text, source) => {
  const out: PackageRef[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0]?.trim() ?? "";
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*==\s*([A-Za-z0-9.+!_-]+)/.exec(line);
    if (m)
      out.push({
        ecosystem: "PyPI",
        name: (m[1] as string).toLowerCase().replace(/_/g, "-"),
        version: m[2] as string,
        source,
        dev: null,
      });
  }
  return out;
};

const poetryLock: LockParser = (text, source) => {
  const out: PackageRef[] = [];
  for (const block of text.split("[[package]]").slice(1)) {
    const n = /^name\s*=\s*"([^"]+)"/m.exec(block);
    const v = /^version\s*=\s*"([^"]+)"/m.exec(block);
    if (n && v)
      out.push({
        ecosystem: "PyPI",
        name: (n[1] as string).toLowerCase(),
        version: v[1] as string,
        source,
        dev: null,
      });
  }
  return out;
};

const PARSERS: Record<string, LockParser> = {
  "package-lock.json": npmLock,
  "npm-shrinkwrap.json": npmLock,
  "yarn.lock": yarnLock,
  "pnpm-lock.yaml": pnpmLock,
  "requirements.txt": requirements,
  "poetry.lock": poetryLock,
};

export function extractPackages(ws: Workspace): { packages: PackageRef[]; sources: string[] } {
  const seen = new Set<string>();
  const packages: PackageRef[] = [];
  const sources: string[] = [];
  for (const f of ws.files) {
    const parser = PARSERS[basename(f.path)];
    if (!parser) continue;
    const text = ws.read(f.path);
    if (text === null) continue;
    const found = parser(text, f.path);
    if (found.length > 0) sources.push(f.path);
    for (const p of found) {
      const key = `${p.ecosystem}|${p.name}|${p.version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      packages.push(p);
    }
  }
  packages.sort((a, b) =>
    `${a.ecosystem}${a.name}${a.version}`.localeCompare(`${b.ecosystem}${b.name}${b.version}`),
  );
  return { packages, sources: sources.sort() };
}

export type OsvFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface OsvVuln {
  id: string;
  summary?: string;
  aliases?: string[];
  database_specific?: { severity?: string };
  affected?: {
    package?: { name?: string; ecosystem?: string };
    ranges?: { events?: { fixed?: string }[] }[];
  }[];
}

const SEV: Record<string, Severity> = {
  CRITICAL: "critical",
  HIGH: "high",
  MODERATE: "medium",
  MEDIUM: "medium",
  LOW: "low",
};

export async function queryOsv(
  packages: PackageRef[],
  opts: { fetchImpl?: OsvFetch; signal?: AbortSignal; maxPackages?: number; maxDetails?: number },
): Promise<{ summary: DependencySecuritySummary; findings: Finding[] }> {
  const doFetch: OsvFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i) as ReturnType<OsvFetch>);
  const maxPackages = opts.maxPackages ?? 3000;
  const checked = packages.slice(0, maxPackages);
  const limitations: string[] = [];
  if (packages.length > maxPackages)
    limitations.push(`Only the first ${maxPackages} of ${packages.length} packages were checked.`);
  const base = { source: "OSV.dev querybatch API", packagesChecked: checked.length };
  try {
    const hits: { pkg: PackageRef; ids: string[] }[] = [];
    for (let i = 0; i < checked.length; i += 1000) {
      const batch = checked.slice(i, i + 1000);
      const res = await doFetch("https://api.osv.dev/v1/querybatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        ...(opts.signal ? { signal: opts.signal } : {}),
        body: JSON.stringify({
          queries: batch.map((p) => ({
            package: { name: p.name, ecosystem: p.ecosystem },
            version: p.version,
          })),
        }),
      });
      if (!res.ok) throw new Error(`OSV returned status ${res.status}`);
      const data = (await res.json()) as {
        results?: { vulns?: { id: string }[]; next_page_token?: string }[];
      };
      (data.results ?? []).forEach((r, k) => {
        if (r.next_page_token)
          limitations.push(`Results for ${batch[k]?.name} were paginated and truncated.`);
        const ids = (r.vulns ?? []).map((v) => v.id);
        if (ids.length > 0) hits.push({ pkg: batch[k] as PackageRef, ids });
      });
    }
    const uniqueIds = [...new Set(hits.flatMap((h) => h.ids))].sort();
    const maxDetails = opts.maxDetails ?? 150;
    const details = new Map<string, OsvVuln>();
    for (const id of uniqueIds.slice(0, maxDetails)) {
      const res = await doFetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      if (res.ok) details.set(id, (await res.json()) as OsvVuln);
    }
    if (uniqueIds.length > maxDetails)
      limitations.push(
        `Details were fetched for ${maxDetails} of ${uniqueIds.length} advisories. The rest use default severity.`,
      );
    const findings: Finding[] = [];
    const norm = (n: string | undefined) => (n ?? "").toLowerCase().replace(/_/g, "-");
    for (const h of hits) {
      for (const id of h.ids) {
        const d = details.get(id);
        const sev = d?.database_specific?.severity
          ? SEV[d.database_specific.severity.toUpperCase()]
          : undefined;
        const mine = (d?.affected ?? []).filter((a) => norm(a.package?.name) === norm(h.pkg.name));
        const others = [
          ...new Set(
            (d?.affected ?? [])
              .map((a) => a.package?.name)
              .filter((n): n is string => !!n && norm(n) !== norm(h.pkg.name)),
          ),
        ].sort();
        const fixed = [
          ...new Set(
            mine.flatMap((a) =>
              (a.ranges ?? []).flatMap((r) =>
                (r.events ?? []).map((e) => e.fixed).filter((x): x is string => !!x),
              ),
            ),
          ),
        ];
        const fix = nearestFix(h.pkg.version, fixed);
        const aliases = (d?.aliases ?? []).filter((a) => a !== id).sort();
        const summary = d?.summary ?? "Advisory listed by OSV.";
        const devNote =
          h.pkg.dev === true
            ? " This is a development-only dependency (not shipped to users), so it counts less in the score."
            : "";
        const otherNote =
          others.length > 0 && mine.length === 0
            ? ` OSV lists other affected packages (${others.join(", ")}). The match was made for ${h.pkg.name}@${h.pkg.version}, so verify that the advisory applies to your usage.`
            : "";
        findings.push({
          id: `RL-SEC-OSV-${shortHash(`${id}|${h.pkg.ecosystem}|${h.pkg.name}|${h.pkg.version}`, 8)}`,
          title: `${h.pkg.name}@${h.pkg.version} has a known vulnerability: ${summary.length > 90 ? `${summary.slice(0, 87)}...` : summary}`,
          category: "security",
          ruleId: "security.osv",
          severity: sev ?? "medium",
          confidence: sev ? "high" : "medium",
          origin: "observed",
          classification: "confirmed",
          explanation:
            `${summary} Advisory ${id}${aliases.length > 0 ? ` (also ${aliases.slice(0, 4).join(", ")})` : ""}. The version listed in ${h.pkg.source} is affected.${devNote}${sev ? "" : " Severity was not provided, so medium is a placeholder."}${otherNote}`.trim(),
          evidence: [
            {
              kind: "tool-output",
              refs: [id, ...aliases.slice(0, 3), `${h.pkg.name}@${h.pkg.version}`],
              note: "OSV.dev match on package, ecosystem and version",
            },
          ],
          locations: [{ path: h.pkg.source, startLine: null, endLine: null }],
          remediation: fix
            ? `Upgrade ${h.pkg.name} from ${h.pkg.version} to ${fix.version} (a ${fix.jump} update${fix.jump === "major" ? " that may need code changes" : ""}).`
            : fixed.length > 0
              ? `No fixed version above ${h.pkg.version} is listed for ${h.pkg.name}. Check advisory ${id}.`
              : `No fixed version is listed for ${h.pkg.name}. Check advisory ${id} for mitigations.`,
          limitations: [
            "The version match is confirmed. Whether the vulnerable code is reachable in this project is not assessed.",
          ],
          tags: [
            "dependency",
            h.pkg.ecosystem,
            `package:${h.pkg.name}`,
            h.pkg.dev === true ? "dev" : h.pkg.dev === false ? "prod" : "scope-unknown",
            ...(fix ? [`jump:${fix.jump}`, `fix:${fix.version}`] : []),
          ],
        });
      }
    }
    findings.sort((a, b) => a.id.localeCompare(b.id));
    return {
      summary: {
        assessed: true,
        reason: limitations.length > 0 ? limitations.join(" ") : null,
        ...base,
        vulnerabilities: findings.length,
      },
      findings,
    };
  } catch (e) {
    return {
      summary: {
        assessed: false,
        reason: `OSV lookup failed: ${(e as Error).message}`,
        source: base.source,
        packagesChecked: null,
        vulnerabilities: null,
      },
      findings: [],
    };
  }
}
