import type { Workspace } from "../acquire/types.js";
import type { Finding, Severity, ToolRun } from "../ir/types.js";
import { shortHash } from "../util/hash.js";

const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const UNTRUSTED =
  /\$\{\{\s*(?:github\.event\.(?:issue\.(?:title|body)|pull_request\.(?:title|body|head\.ref|head\.label|head\.repo\.default_branch)|comment\.body|review\.body|review_comment\.body|head_commit\.(?:message|author\.(?:email|name))|commits\[[^\]]*\]\.message|pages\[[^\]]*\]\.page_name)|github\.head_ref)[^}]*\}\}/;

function mk(
  rule: string,
  path: string,
  line: number | null,
  severity: Severity,
  title: string,
  explanation: string,
  remediation: string,
  classification: "probable" | "heuristic",
  key: string,
): Finding {
  return {
    id: `RL-SEC-WF-${rule.toUpperCase()}-${shortHash(`${rule}|${path}|${key}`, 8)}`,
    title,
    category: "security",
    ruleId: `security.workflow.${rule}`,
    severity,
    confidence: classification === "probable" ? "medium" : "low",
    origin: "observed",
    classification,
    explanation,
    evidence: [{ kind: "location", refs: [path], note: key }],
    locations: [{ path, startLine: line, endLine: line }],
    remediation,
    limitations: [
      "Line based inspection of the workflow text. It does not evaluate expressions, reusable workflows or repository settings.",
    ],
    tags: ["github-actions"],
  };
}

export function checkWorkflows(ws: Workspace): { run: ToolRun; findings: Finding[] } {
  const findings: Finding[] = [];
  let inspected = 0;
  for (const f of ws.files) {
    if (!WORKFLOW.test(f.path)) continue;
    const text = ws.read(f.path);
    if (text === null) continue;
    inspected++;
    const lines = text.split(/\r\n|\r|\n/);
    let hasPermissions = false;
    let prTarget = false;
    let prTargetLine: number | null = null;
    let checkoutHead: number | null = null;
    let inRun: { indent: number } | null = null;
    // The same action used several times is one finding with every line, not one finding that hides the rest.
    const unpinned = new Map<string, { name: string; ref: string; lines: number[] }>();
    lines.forEach((raw, i) => {
      const no = i + 1;
      const noComment = raw.replace(/\s+#.*$/, "");
      const indent = raw.length - raw.trimStart().length;
      if (inRun && raw.trim() !== "" && indent <= inRun.indent) inRun = null;
      if (/^permissions\s*:/.test(raw)) {
        hasPermissions = true;
        if (/write-all/.test(raw))
          findings.push(
            mk(
              "write-all",
              f.path,
              no,
              "medium",
              "Workflow grants write-all permissions",
              "The workflow token gets write access to every scope.",
              "Declare the minimum permissions the jobs need, for example contents: read.",
              "probable",
              `line ${no}`,
            ),
          );
      }
      if (/^\s+permissions\s*:/.test(raw)) hasPermissions = true;
      if (/pull_request_target/.test(noComment) && !/^\s*#/.test(raw)) {
        prTarget = true;
        prTargetLine ??= no;
      }
      if (
        /(?:github\.event\.pull_request\.head\.(?:sha|ref)|github\.head_ref)/.test(noComment) &&
        /ref\s*:/.test(noComment)
      )
        checkoutHead = no;
      const use = /^\s*-?\s*uses\s*:\s*['"]?([^'"\s]+)['"]?/.exec(noComment);
      if (use) {
        const spec = use[1] as string;
        if (!spec.startsWith("./") && !spec.startsWith("docker://")) {
          const [name, ref] = spec.split("@");
          if (ref !== undefined && !/^[0-9a-f]{40}$/.test(ref)) {
            const rec = unpinned.get(spec) ?? { name: name as string, ref, lines: [] };
            rec.lines.push(no);
            unpinned.set(spec, rec);
          }
        }
      }
      const runStart = /^(\s*)(?:-\s+)?run\s*:\s*(.*)$/.exec(raw);
      if (runStart) {
        const rest = (runStart[2] as string).trim();
        if (/^[|>][-+]?$/.test(rest)) inRun = { indent: (runStart[1] as string).length };
        else if (UNTRUSTED.test(rest))
          findings.push(
            mk(
              "script-injection",
              f.path,
              no,
              "high",
              "Untrusted input is interpolated into a shell command",
              "A value controlled by an external user is expanded directly into a run script, which allows command injection.",
              "Pass the value through an environment variable and reference it as a quoted shell variable.",
              "probable",
              `line ${no}`,
            ),
          );
      } else if (inRun && UNTRUSTED.test(raw)) {
        findings.push(
          mk(
            "script-injection",
            f.path,
            no,
            "high",
            "Untrusted input is interpolated into a shell command",
            "A value controlled by an external user is expanded directly into a run script, which allows command injection.",
            "Pass the value through an environment variable and reference it as a quoted shell variable.",
            "probable",
            `line ${no}`,
          ),
        );
      }
    });
    for (const [spec, rec] of unpinned) {
      const firstParty = /^(actions|github)\//.test(rec.name);
      const f1 = mk(
        "unpinned-action",
        f.path,
        rec.lines[0] ?? null,
        firstParty ? "low" : "medium",
        `Action ${rec.name} is not pinned to a commit SHA`,
        `The action is referenced by the mutable ref ${rec.ref}${rec.lines.length > 1 ? ` in ${rec.lines.length} places (lines ${rec.lines.join(", ")})` : ""}. A moved tag would change what runs in this workflow.`,
        "Pin the action to a full commit SHA and let Dependabot update it.",
        "heuristic",
        spec,
      );
      f1.locations = rec.lines
        .slice(0, 10)
        .map((l) => ({ path: f.path, startLine: l, endLine: l }));
      findings.push(f1);
    }
    if (prTarget && checkoutHead !== null)
      findings.push(
        mk(
          "pr-target-checkout",
          f.path,
          checkoutHead,
          "high",
          "pull_request_target workflow checks out code from the pull request",
          "pull_request_target runs with repository secrets. Checking out and running pull request code in it lets a contributor execute code with those secrets.",
          "Use the pull_request trigger for untrusted code, or avoid checking out the head ref in pull_request_target workflows.",
          "probable",
          `line ${checkoutHead}`,
        ),
      );
    else if (prTarget)
      findings.push(
        mk(
          "pr-target",
          f.path,
          prTargetLine,
          "low",
          "Workflow uses pull_request_target",
          "This trigger runs with elevated privileges. It is safe only if the workflow never runs code from the pull request.",
          "Review the workflow and confirm it does not execute contributor controlled code.",
          "heuristic",
          `line ${prTargetLine}`,
        ),
      );
    if (!hasPermissions)
      findings.push(
        mk(
          "no-permissions",
          f.path,
          null,
          "low",
          "Workflow does not declare token permissions",
          "Without a permissions block the workflow token uses the repository default, which may be broader than required.",
          "Add a top level permissions block with the least privilege needed.",
          "heuristic",
          "permissions",
        ),
      );
  }
  const unique = new Map(findings.map((x) => [x.id, x]));
  const list = [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
  return {
    run: {
      assessed: inspected > 0,
      reason: inspected > 0 ? null : "No GitHub Actions workflows found",
      tool: "builtin-workflow-checks",
      findings: inspected > 0 ? list.length : null,
    },
    findings: list,
  };
}
