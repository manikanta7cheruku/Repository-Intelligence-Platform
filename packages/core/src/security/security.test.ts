import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../config/config.js";
import { openLocalWorkspace } from "../acquire/local.js";
import type { FileKind } from "../ir/types.js";
import { extractPackages, queryOsv, type OsvFetch } from "./osv.js";
import { runGitleaks, scanSecretsBuiltin } from "./secrets.js";
import { checkWorkflows } from "./workflows.js";

let dirs: string[] = [];
const make = (files: Record<string, string>) => {
  const d = mkdtempSync(join(tmpdir(), "rl-sec-"));
  dirs.push(d);
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return openLocalWorkspace(d, resolveConfig({}));
};
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("extractPackages", () => {
  it("reads package-lock v3, yarn v1, pnpm v9 and requirements files", () => {
    const ws = make({
      "package-lock.json": JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": { name: "r" },
          "node_modules/lodash": { version: "4.17.20" },
          "node_modules/a/node_modules/@s/b": { version: "1.0.0" },
          "node_modules/linked": { link: true },
        },
      }),
      "yarn.lock":
        '# yarn lockfile v1\n\n"@babel/core@^7.0.0", "@babel/core@^7.1.0":\n  version "7.20.0"\n\nleft-pad@^1.0.0:\n  version "1.3.0"\n',
      "pnpm-lock.yaml":
        "lockfileVersion: '9.0'\npackages:\n  express@4.18.2:\n    resolution: {}\n  '@types/node@20.1.0':\n    resolution: {}\n  react@18.2.0(peer@1.0.0):\n    resolution: {}\nsnapshots:\n  x@1.0.0: {}\n",
      "sub/requirements.txt":
        "Django==3.2.0\nflask[async]==2.0.1  # comment\nrequests>=2\n-r other.txt\n",
    });
    const { packages } = extractPackages(ws);
    const view = packages.map((p) => `${p.ecosystem}:${p.name}@${p.version}`);
    for (const want of [
      "npm:lodash@4.17.20",
      "npm:@s/b@1.0.0",
      "npm:@babel/core@7.20.0",
      "npm:left-pad@1.3.0",
      "npm:express@4.18.2",
      "npm:@types/node@20.1.0",
      "npm:react@18.2.0",
      "PyPI:django@3.2.0",
      "PyPI:flask@2.0.1",
    ]) {
      expect(view).toContain(want);
    }
    expect(view).not.toContain("npm:linked@undefined");
    expect(view.some((v) => v.startsWith("npm:x@"))).toBe(false);
    expect(view.some((v) => v.includes("requests"))).toBe(false);
  });
});

const jsonRes = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) });

describe("queryOsv", () => {
  const pkgs = [
    { ecosystem: "npm" as const, name: "lodash", version: "4.17.20", source: "package-lock.json" },
    { ecosystem: "npm" as const, name: "safe", version: "1.0.0", source: "package-lock.json" },
  ];
  it("turns advisories into confirmed findings with severity and fixed versions", async () => {
    const fetchImpl: OsvFetch = (url) => {
      if (url.endsWith("/v1/querybatch"))
        return jsonRes({ results: [{ vulns: [{ id: "GHSA-1111" }] }, {}] });
      return jsonRes({
        id: "GHSA-1111",
        summary: "Prototype pollution",
        database_specific: { severity: "HIGH" },
        affected: [
          {
            package: { name: "lodash", ecosystem: "npm" },
            ranges: [{ events: [{ introduced: "0" }, { fixed: "4.17.21" }] }],
          },
        ],
      });
    };
    const r = await queryOsv(pkgs, { fetchImpl });
    expect(r.summary).toMatchObject({ assessed: true, packagesChecked: 2, vulnerabilities: 1 });
    const f = r.findings[0];
    expect(f?.severity).toBe("high");
    expect(f?.classification).toBe("confirmed");
    expect(f?.remediation).toContain("from 4.17.20 to 4.17.21");
    expect(f?.limitations.join(" ")).toMatch(/reachable/);
  });
  it("is not assessed, never zero, when OSV is unreachable", async () => {
    const r = await queryOsv(pkgs, { fetchImpl: () => Promise.reject(new Error("network down")) });
    expect(r.summary.assessed).toBe(false);
    expect(r.summary.vulnerabilities).toBeNull();
    expect(r.summary.reason).toMatch(/network down/);
    expect(r.findings).toEqual([]);
  });
  it("is not assessed on an HTTP error", async () => {
    const r = await queryOsv(pkgs, { fetchImpl: () => jsonRes({}, false, 500) });
    expect(r.summary.assessed).toBe(false);
  });
  it("uses a placeholder severity and says so when the advisory has none", async () => {
    const fetchImpl: OsvFetch = (url) =>
      url.endsWith("querybatch")
        ? jsonRes({ results: [{ vulns: [{ id: "OSV-2" }] }, {}] })
        : jsonRes({ id: "OSV-2", summary: "x" });
    const r = await queryOsv(pkgs, { fetchImpl });
    expect(r.findings[0]?.confidence).toBe("medium");
    expect(r.findings[0]?.explanation).toMatch(/placeholder/);
  });
});

// Secret-like values are assembled at runtime so this repository never contains them.
const fake = {
  aws: ["AKIA", "ZXCVBNMASDFGHJKL"].join(""),
  gh: ["ghp", "_", "a1B2".repeat(9)].join(""),
  key: ["-----BEGIN ", "RSA PRIVATE KEY", "-----"].join(""),
  stripe: ["sk", "_live_", "x".repeat(24)].join(""),
};
const kindsOf = (ws: { files: { path: string }[] }, k: FileKind = "source") =>
  new Map(ws.files.map((f) => [f.path, k]));

describe("scanSecretsBuiltin", () => {
  it("finds token formats, redacts the value and records only location and rule", () => {
    const ws = make({
      "src/config.ts": `const a = "${fake.aws}";\nconst g = '${fake.gh}';\n`,
      "deploy/key.pem": `${fake.key}\nabc\n`,
      "src/pay.ts": `const s = "${fake.stripe}";`,
    });
    const { run, findings } = scanSecretsBuiltin(ws, kindsOf(ws));
    expect(run.assessed).toBe(true);
    expect(findings.map((f) => f.ruleId).sort()).toEqual([
      "security.secret.aws-access-key-id",
      "security.secret.github-token",
      "security.secret.private-key",
      "security.secret.stripe-live-key",
    ]);
    const json = JSON.stringify(findings);
    for (const v of Object.values(fake)) expect(json).not.toContain(v);
    expect(
      findings.every((f) => f.classification === "probable" && f.locations[0]?.startLine !== null),
    ).toBe(true);
  });
  it("ignores documentation examples and lowers confidence in test files", () => {
    const ws = make({
      "README.md": "key AKIAIOSFODNN7EXAMPLE",
      "t/a.test.ts": `const a = "${fake.aws}";`,
    });
    const kinds = new Map<string, FileKind>([
      ["README.md", "docs"],
      ["t/a.test.ts", "test"],
    ]);
    const { findings } = scanSecretsBuiltin(ws, kinds);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("low");
  });
  it("skips binary, vendored and generated files", () => {
    const ws = make({ "a.png": fake.aws, "vendor/x.js": fake.aws });
    const kinds = new Map<string, FileKind>([
      ["a.png", "binary"],
      ["vendor/x.js", "vendored"],
    ]);
    expect(scanSecretsBuiltin(ws, kinds).findings).toEqual([]);
  });
});

describe("runGitleaks", () => {
  it("is not assessed when the binary is missing", async () => {
    const ws = make({ "a.ts": "x" });
    const r = await runGitleaks(ws.root, "/definitely/missing/gitleaks", kindsOf(ws));
    expect(r.run.assessed).toBe(false);
    expect(r.run.reason).toMatch(/not installed/);
  });
  it("parses a report without ever reading the secret value", async () => {
    if (process.platform === "win32") return;
    const ws = make({ "src/a.ts": "x" });
    const bin = join(ws.root, "..", `fake-gl-${Date.now()}.sh`);
    writeFileSync(
      bin,
      `#!/bin/sh\nif [ "$1" = "version" ]; then echo 8.0.0; exit 0; fi\nwhile [ $# -gt 0 ]; do if [ "$1" = "--report-path" ]; then out="$2"; fi; shift; done\necho '[{"RuleID":"generic-api-key","Description":"Generic API Key","File":"${ws.root}/src/a.ts","StartLine":3,"Secret":"SUPERSECRETVALUE","Match":"SUPERSECRETVALUE"}]' > "$out"\n`,
    );
    chmodSync(bin, 0o755);
    dirs.push(bin);
    const r = await runGitleaks(ws.root, bin, kindsOf(ws));
    expect(r.run).toMatchObject({ assessed: true, findings: 1 });
    expect(r.findings[0]?.locations[0]).toEqual({ path: "src/a.ts", startLine: 3, endLine: 3 });
    expect(JSON.stringify(r.findings)).not.toContain("SUPERSECRETVALUE");
  });
});

describe("checkWorkflows", () => {
  it("is not assessed when there are no workflows", () => {
    const r = checkWorkflows(make({ "a.ts": "x" }));
    expect(r.run.assessed).toBe(false);
    expect(r.run.findings).toBeNull();
  });
  it("reports line numbers and severity per check", () => {
    const ws = make({
      ".github/workflows/x.yml": [
        "name: x",
        "on: push",
        "jobs:",
        "  a:",
        "    steps:",
        "      - uses: third/party@v2",
        "      - run: echo ${{ github.head_ref }}",
      ].join("\n"),
    });
    const { findings } = checkWorkflows(ws);
    const by = Object.fromEntries(
      findings.map((f) => [f.ruleId.replace("security.workflow.", ""), f]),
    );
    expect(by["unpinned-action"]?.locations[0]?.startLine).toBe(6);
    expect(by["unpinned-action"]?.severity).toBe("medium");
    expect(by["script-injection"]?.locations[0]?.startLine).toBe(7);
    expect(by["no-permissions"]).toBeDefined();
  });
  it("treats SHA pinned actions and local actions as fine", () => {
    const ws = make({
      ".github/workflows/x.yml":
        "name: x\non: push\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - uses: ./local-action\n      - uses: a/b@0123456789abcdef0123456789abcdef01234567\n",
    });
    expect(checkWorkflows(ws).findings).toEqual([]);
  });
});
