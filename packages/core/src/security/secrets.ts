import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Workspace } from "../acquire/types.js";
import type { FileKind, Finding, ToolRun } from "../ir/types.js";
import { shortHash } from "../util/hash.js";
import { toPosix } from "../util/paths.js";

const run = promisify(execFile);

interface SecretPattern {
  id: string;
  description: string;
  regex: RegExp;
}

/** High precision token formats only. This is a safety net, not a replacement for Gitleaks. */
export const SECRET_PATTERNS: SecretPattern[] = [
  {
    id: "aws-access-key-id",
    description: "AWS access key ID",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    id: "github-token",
    description: "GitHub token",
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,})\b/,
  },
  { id: "slack-token", description: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  {
    id: "private-key",
    description: "private key block",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  { id: "google-api-key", description: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    id: "stripe-live-key",
    description: "Stripe live key",
    regex: /\b[sr]k_live_[0-9a-zA-Z]{24,}\b/,
  },
  { id: "npm-token", description: "npm access token", regex: /\bnpm_[A-Za-z0-9]{36}\b/ },
];

function secretFinding(
  ruleId: string,
  description: string,
  path: string,
  line: number | null,
  tool: string,
  kind: FileKind | null,
): Finding {
  const inTest = kind === "test";
  return {
    id: `RL-SEC-SECRET-${shortHash(`${tool}|${ruleId}|${path}|${line}`, 8)}`,
    title: `Possible ${description} committed in ${path}`,
    category: "security",
    ruleId: `security.secret.${ruleId}`,
    severity: "high",
    confidence: inTest ? "low" : "medium",
    origin: "observed",
    classification: "probable",
    explanation: `A value matching the ${description} format was found. The matched value is deliberately not stored in this report.${inTest ? " The file is a test file, so it may be a fake credential." : ""}`,
    evidence: [{ kind: "tool-output", refs: [path], note: `${tool} rule ${ruleId}` }],
    locations: [{ path, startLine: line, endLine: line }],
    remediation:
      "Revoke and rotate the credential, remove it from the repository and its history, and load it from a secret store or environment variable.",
    limitations: [
      "Pattern based detection can match test fixtures or documentation examples.",
      "Removing the value from the latest commit does not remove it from Git history.",
    ],
    tags: ["secret", tool],
  };
}

export function scanSecretsBuiltin(
  ws: Workspace,
  kinds: Map<string, FileKind>,
): { run: ToolRun; findings: Finding[] } {
  const findings: Finding[] = [];
  for (const f of ws.files) {
    const kind = kinds.get(f.path) ?? null;
    if (kind === "binary" || kind === "vendored" || kind === "generated") continue;
    const text = ws.read(f.path);
    if (text === null) continue;
    const lines = text.split(/\r\n|\r|\n/);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i] as string;
      if (l.length > 2000) continue;
      for (const p of SECRET_PATTERNS) {
        const m = p.regex.exec(l);
        if (!m || /EXAMPLE|example|PLACEHOLDER|placeholder/.test(m[0])) continue;
        findings.push(secretFinding(p.id, p.description, f.path, i + 1, "builtin-patterns", kind));
      }
    }
  }
  findings.sort((a, b) => a.id.localeCompare(b.id));
  return {
    run: {
      assessed: true,
      reason: "Limited built-in token patterns. Install Gitleaks for broader coverage.",
      tool: "builtin-patterns",
      findings: findings.length,
    },
    findings,
  };
}

interface GitleaksLeak {
  RuleID?: string;
  Description?: string;
  File?: string;
  StartLine?: number;
}

export async function runGitleaks(
  root: string,
  gitleaksPath: string | null,
  kinds: Map<string, FileKind>,
  signal?: AbortSignal,
): Promise<{ run: ToolRun; findings: Finding[] }> {
  const bin = gitleaksPath ?? "gitleaks";
  const notRun = (reason: string): { run: ToolRun; findings: Finding[] } => ({
    run: { assessed: false, reason, tool: "gitleaks", findings: null },
    findings: [],
  });
  try {
    await run(bin, ["version"], { timeout: 10_000 });
  } catch {
    return notRun("Gitleaks is not installed or not on PATH");
  }
  const dir = mkdtempSync(join(tmpdir(), "repolens-gl-"));
  const report = join(dir, "report.json");
  try {
    await run(
      bin,
      [
        "detect",
        "--no-git",
        "--source",
        root,
        "--report-format",
        "json",
        "--report-path",
        report,
        "--redact",
        "--no-banner",
        "--exit-code",
        "0",
      ],
      {
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
        ...(signal ? { signal } : {}),
      },
    );
    const leaks = JSON.parse(readFileSync(report, "utf8") || "[]") as GitleaksLeak[];
    if (!Array.isArray(leaks)) return notRun("Gitleaks produced an unexpected report format");
    const prefix = `${toPosix(root).replace(/\/$/, "")}/`;
    const findings = leaks
      .map((l) => {
        const file = toPosix(l.File ?? "unknown").replace(prefix, "");
        return secretFinding(
          String(l.RuleID ?? "unknown").replace(/[^A-Za-z0-9_.-]/g, "-"),
          String(l.Description ?? "secret").toLowerCase(),
          file,
          typeof l.StartLine === "number" ? l.StartLine : null,
          "gitleaks",
          kinds.get(file) ?? null,
        );
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      run: { assessed: true, reason: null, tool: "gitleaks", findings: findings.length },
      findings,
    };
  } catch (e) {
    return notRun(`Gitleaks failed: ${(e as Error).message.split("\n")[0]}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
