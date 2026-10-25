import {
  acquireTarget,
  analyze,
  GitHubUrlError,
  parseGitHubUrl,
  resolveConfig,
  validateReport,
} from "@repolens/core/server";

export const runtime = "nodejs";
// Conservative. Raise only after checking the current plan limits (unverified, see docs/phases/phase-2-web.md).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BODY = 2_000;
const WINDOW_MS = 10 * 60_000;
const hits = new Map<string, number[]>();

/** Best effort per instance. A shared store would be needed for a hard limit (documented limitation). */
/** Limit per address per 10 minutes. Override with RIP_MAX_ANALYSES_PER_10_MIN. Requests without a forwarded address (local use) are not limited. */
function limited(ip: string | null): boolean {
  if (ip === null) return false;
  const max = Number(process.env.RIP_MAX_ANALYSES_PER_10_MIN ?? 20) || 20;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000)
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return recent.length > max;
}

const line = (o: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(o)}\n`);

export async function POST(req: Request): Promise<Response> {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded ? forwarded : null;
  if (limited(ip))
    return Response.json(
      {
        error:
          "Too many analyses from this address. Try again in a few minutes, or run the CLI locally.",
      },
      { status: 429 },
    );

  let body: { url?: unknown; includeTests?: unknown; history?: unknown };
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) throw new Error("too large");
    body = JSON.parse(text) as typeof body;
  } catch {
    return Response.json({ error: "The request body is not valid." }, { status: 400 });
  }
  if (typeof body.url !== "string")
    return Response.json({ error: "A GitHub repository URL is required." }, { status: 400 });

  let spec: ReturnType<typeof parseGitHubUrl>;
  try {
    spec = parseGitHubUrl(body.url);
  } catch (e) {
    return Response.json(
      { error: e instanceof GitHubUrlError ? e.message : "That URL is not accepted." },
      { status: 400 },
    );
  }

  const config = resolveConfig({
    includeTests: body.includeTests !== false,
    history: { enabled: body.history !== false, authors: "names" },
    // Budgets keep one request inside the function time and memory limits.
    budgets: { analysisTimeoutMs: 50_000, maxArchiveBytes: 200 * 1024 * 1024, maxFiles: 8_000 },
  });
  const token = process.env.GITHUB_TOKEN;
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => {
        try {
          controller.enqueue(line(o));
        } catch {
          /* client went away */
        }
      };
      let acquired: Awaited<ReturnType<typeof acquireTarget>> | null = null;
      try {
        send({ stage: "acquiring", detail: `${spec.owner}/${spec.repo}` });
        acquired = await acquireTarget(body.url as string, {
          config,
          token,
          withHistory: false,
          signal: abort.signal,
        });
        const report = await analyze({
          config,
          workspace: acquired.workspace,
          source: acquired.source,
          commitSha: acquired.commitSha,
          historyRoot: null,
          signal: abort.signal,
          activity:
            body.history === false
              ? null
              : { owner: spec.owner, repo: spec.repo, ref: spec.ref, token },
          onProgress: (stage, detail) => send({ stage, detail: detail ?? null }),
        });
        const check = validateReport(report);
        if (!check.valid) throw new Error("The generated report failed validation.");
        send({ report });
      } catch (e) {
        const message = abort.signal.aborted
          ? "The analysis was cancelled."
          : e instanceof Error
            ? e.message
            : "The analysis failed.";
        send({ error: message });
      } finally {
        acquired?.cleanup();
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function GET(): Response {
  return Response.json({ error: "Use POST with a GitHub repository URL." }, { status: 405 });
}
