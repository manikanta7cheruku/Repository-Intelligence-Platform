import type { Confidence, Finding, Recommendation, Severity } from "../ir/types.js";

const SEV_W: Record<Severity, number> = { critical: 100, high: 60, medium: 30, low: 10, info: 2 };
const CONF_W: Record<Confidence, number> = { high: 1, medium: 0.7, low: 0.4 };

const TEMPLATES: Record<
  string,
  { title: (n: number) => string; effort: "low" | "medium" | "high" }
> = {
  "security.osv": {
    title: (n) => `Upgrade ${n} vulnerable ${n === 1 ? "dependency" : "dependencies"}`,
    effort: "low",
  },
  "arch.cycle.file": {
    title: (n) => `Break ${n} circular ${n === 1 ? "dependency" : "dependencies"} between files`,
    effort: "medium",
  },
  "arch.cycle.module": {
    title: (n) => `Resolve ${n} module ${n === 1 ? "cycle" : "cycles"}`,
    effort: "high",
  },
  "quality.function-complexity": {
    title: (n) => `Simplify ${n} highly complex ${n === 1 ? "function" : "functions"}`,
    effort: "high",
  },
  "quality.duplication": { title: () => "Reduce duplicated code", effort: "medium" },
  "quality.large-file": {
    title: (n) => `Split ${n} very large ${n === 1 ? "file" : "files"}`,
    effort: "medium",
  },
  "security.workflow.script-injection": {
    title: (n) => `Fix ${n} script injection ${n === 1 ? "risk" : "risks"} in workflows`,
    effort: "low",
  },
  "security.workflow.pr-target-checkout": {
    title: () => "Stop checking out pull request code in pull_request_target workflows",
    effort: "low",
  },
  "security.workflow.unpinned-action": {
    title: (n) => `Pin ${n} GitHub ${n === 1 ? "Action" : "Actions"} to commit SHAs`,
    effort: "low",
  },
  "practice.no-ci": { title: () => "Add continuous integration", effort: "medium" },
  "practice.no-tests": { title: () => "Add automated tests", effort: "high" },
  "practice.no-license": { title: () => "Add a license", effort: "low" },
  "practice.no-readme": { title: () => "Add a README", effort: "low" },
  "practice.no-lockfile": { title: () => "Commit a dependency lockfile", effort: "low" },
  "history.hotspot": {
    title: (n) => `Refactor ${n} change-prone complex ${n === 1 ? "file" : "files"}`,
    effort: "high",
  },
};

export function buildRecommendations(findings: Finding[], limit = 12): Recommendation[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    if (f.severity === "info" || f.category === "analysis") continue;
    const key = f.ruleId.startsWith("security.secret.")
      ? "security.secret"
      : f.ruleId.startsWith("rule.")
        ? f.ruleId
        : f.ruleId;
    (groups.get(key) ?? groups.set(key, []).get(key))?.push(f);
  }
  const recs = [...groups.entries()].map(([key, list]) => {
    const top = Math.max(...list.map((f) => SEV_W[f.severity] * CONF_W[f.confidence]));
    const priority = Math.round((top + 5 * Math.log(list.length)) * 10) / 10;
    const tpl =
      key === "security.secret"
        ? {
            title: (n: number) =>
              `Revoke and remove ${n} possible committed ${n === 1 ? "secret" : "secrets"}`,
            effort: "low" as const,
          }
        : key.startsWith("rule.")
          ? {
              title: (n: number) =>
                `Fix ${n} violation${n === 1 ? "" : "s"} of architecture rule ${key.slice(5)}`,
              effort: "medium" as const,
            }
          : TEMPLATES[key];
    return {
      key,
      priority,
      findingIds: list.map((f) => f.id).sort(),
      title: tpl ? tpl.title(list.length) : (list[0] as Finding).title,
      rationale: `Highest severity ${list.slice().sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity])[0]?.severity}, ${list.length} finding${list.length === 1 ? "" : "s"}. Priority = severity weight times confidence weight, plus 5 times the natural log of the finding count.`,
      effort: tpl?.effort ?? null,
    };
  });
  recs.sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
  return recs
    .slice(0, limit)
    .map((r, idx) => ({
      rank: idx + 1,
      title: r.title,
      rationale: r.rationale,
      priority: r.priority,
      findingIds: r.findingIds,
      effort: r.effort,
    }));
}
