import { isIP } from "node:net";

export class GitHubUrlError extends Error {}

export interface GitHubRepoRef {
  owner: string;
  repo: string;
  ref: string | null;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const ALLOWED_HOSTS = new Set(["github.com", "www.github.com"]);
const ALLOWED_REDIRECT_HOSTS = new Set(["api.github.com", "codeload.github.com"]);

/**
 * Strict parser for public GitHub repository URLs.
 * Rejects non-https, credentials, ports, IP hosts, other hosts, and malformed owner or repo names.
 */
export function parseGitHubUrl(input: string): GitHubRepoRef {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new GitHubUrlError("Not a valid URL");
  }
  if (url.protocol !== "https:") throw new GitHubUrlError("Only https URLs are accepted");
  if (url.username || url.password)
    throw new GitHubUrlError("URLs with credentials are not accepted");
  if (url.port) throw new GitHubUrlError("URLs with ports are not accepted");
  if (isIP(url.hostname) !== 0 || url.hostname.startsWith("["))
    throw new GitHubUrlError("IP address hosts are not accepted");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase()))
    throw new GitHubUrlError("Only github.com repositories are supported");
  const parts = url.pathname.split("/").filter(Boolean);
  const owner = parts[0];
  const repoRaw = parts[1];
  if (!owner || !repoRaw)
    throw new GitHubUrlError("URL must point to a repository: https://github.com/owner/repo");
  const repo = repoRaw.replace(/\.git$/, "");
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === "." || repo === "..") {
    throw new GitHubUrlError("Invalid owner or repository name");
  }
  let ref: string | null = null;
  if (parts[2] === "tree" && parts.length >= 4) ref = decodeURIComponent(parts.slice(3).join("/"));
  if (ref !== null && !isSafeRef(ref)) throw new GitHubUrlError("Invalid ref");
  return { owner, repo, ref };
}

export function isSafeRef(ref: string): boolean {
  return (
    /^[A-Za-z0-9._\-/]{1,200}$/.test(ref) &&
    !ref.includes("..") &&
    !ref.startsWith("-") &&
    !ref.startsWith("/")
  );
}

export interface FetchedArchive {
  data: Buffer;
  commitSha: string | null;
  ref: string | null;
}

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; redirect: "manual"; signal?: AbortSignal },
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export interface FetchOptions {
  maxBytes: number;
  token?: string | undefined;
  signal?: AbortSignal | undefined;
  fetchImpl?: FetchLike | undefined;
  maxRedirects?: number;
}

/** Downloads a repository tarball through the GitHub API. Redirects are followed only to allow-listed hosts. */
export async function fetchGitHubArchive(
  spec: GitHubRepoRef,
  opts: FetchOptions,
): Promise<FetchedArchive> {
  const doFetch: FetchLike =
    opts.fetchImpl ?? ((url, init) => fetch(url, init) as ReturnType<FetchLike>);
  const refPart = spec.ref ? `/${spec.ref.split("/").map(encodeURIComponent).join("/")}` : "";
  let url = `https://api.github.com/repos/${encodeURIComponent(spec.owner)}/${encodeURIComponent(spec.repo)}/tarball${refPart}`;
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "repolens",
    "x-github-api-version": "2022-11-28",
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

  const maxRedirects = opts.maxRedirects ?? 3;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await doFetch(url, {
      headers,
      redirect: "manual",
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new GitHubUrlError("Redirect without location");
      const next = new URL(location, url);
      if (next.protocol !== "https:" || !ALLOWED_REDIRECT_HOSTS.has(next.hostname)) {
        throw new GitHubUrlError(`Refusing redirect to ${next.hostname}`);
      }
      // Never forward the token to a different host than the one it was issued for.
      if (next.hostname !== new URL(url).hostname) delete headers.authorization;
      url = next.toString();
      continue;
    }
    if (res.status === 404)
      throw new GitHubUrlError("Repository or ref not found, or it is private");
    if (res.status === 403 || res.status === 429)
      throw new GitHubUrlError(
        "GitHub rate limit or access restriction. Try again later or set GITHUB_TOKEN",
      );
    if (res.status !== 200) throw new GitHubUrlError(`GitHub returned status ${res.status}`);
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > opts.maxBytes)
      throw new GitHubUrlError("Repository archive exceeds the size budget");
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > opts.maxBytes)
      throw new GitHubUrlError("Repository archive exceeds the size budget");
    return { data, commitSha: null, ref: spec.ref };
  }
  throw new GitHubUrlError("Too many redirects");
}

/** GitHub archives have a root directory named owner-repo-<shortsha>. */
export function commitFromRootDir(rootDir: string | null): string | null {
  if (!rootDir) return null;
  const m = /-([0-9a-f]{7,40})$/.exec(rootDir);
  return m ? (m[1] as string) : null;
}

export type StreamFetchLike = (
  url: string,
  init: { headers: Record<string, string>; redirect: "manual"; signal?: AbortSignal },
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  body: AsyncIterable<Uint8Array> | null;
}>;

export interface OpenArchiveOptions {
  maxBytes: number;
  token?: string | undefined;
  signal?: AbortSignal | undefined;
  fetchImpl?: StreamFetchLike | undefined;
  maxRedirects?: number;
}

export interface OpenArchive {
  body: AsyncIterable<Uint8Array>;
  contentLength: number | null;
  ref: string | null;
}

const defaultStreamFetch: StreamFetchLike = async (url, init) => {
  const res = await fetch(url, init);
  const { Readable } = await import("node:stream");
  return {
    status: res.status,
    headers: res.headers,
    body: res.body
      ? (Readable.fromWeb(
          res.body as unknown as import("node:stream/web").ReadableStream,
        ) as AsyncIterable<Uint8Array>)
      : null,
  };
};

/**
 * Opens a repository archive as a stream. codeload.github.com is tried first: it does not use the REST API quota, which
 * is only 60 requests per hour without a token. The API tarball endpoint is the fallback for private access with a token.
 * Redirects are followed only to allow-listed hosts and the token is never sent to another host.
 */
export async function openGitHubArchive(
  spec: GitHubRepoRef,
  opts: OpenArchiveOptions,
): Promise<OpenArchive> {
  const doFetch = opts.fetchImpl ?? defaultStreamFetch;
  const owner = encodeURIComponent(spec.owner);
  const repo = encodeURIComponent(spec.repo);
  const refPath = spec.ref ? spec.ref.split("/").map(encodeURIComponent).join("/") : "HEAD";
  const candidates: { url: string; auth: boolean }[] = [
    { url: `https://codeload.github.com/${owner}/${repo}/tar.gz/${refPath}`, auth: false },
  ];
  if (opts.token)
    candidates.push({
      url: `https://api.github.com/repos/${owner}/${repo}/tarball${spec.ref ? `/${refPath}` : ""}`,
      auth: true,
    });

  let lastStatus = 0;
  for (const cand of candidates) {
    let url = cand.url;
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "repolens",
      "x-github-api-version": "2022-11-28",
    };
    if (cand.auth && opts.token) headers.authorization = `Bearer ${opts.token}`;
    for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
      const res = await doFetch(url, {
        headers,
        redirect: "manual",
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new GitHubUrlError("Redirect without location");
        const next = new URL(location, url);
        if (next.protocol !== "https:" || !ALLOWED_REDIRECT_HOSTS.has(next.hostname))
          throw new GitHubUrlError(`Refusing redirect to ${next.hostname}`);
        if (next.hostname !== new URL(url).hostname) delete headers.authorization;
        url = next.toString();
        continue;
      }
      lastStatus = res.status;
      if (res.status === 200 && res.body) {
        const declared = Number(res.headers.get("content-length") ?? "0");
        if (declared > opts.maxBytes)
          throw new GitHubUrlError(
            `The repository download is ${Math.round(declared / 1048576)} MB, above the budget of ${Math.round(opts.maxBytes / 1048576)} MB. Analyze it with the command line instead.`,
          );
        return { body: res.body, contentLength: declared > 0 ? declared : null, ref: spec.ref };
      }
      break;
    }
  }
  if (lastStatus === 404)
    throw new GitHubUrlError(
      "Repository or branch not found, or it is private. Only public repositories can be analyzed here.",
    );
  if (lastStatus === 403 || lastStatus === 429)
    throw new GitHubUrlError(
      "GitHub refused the download (rate limit or access restriction). Try again later, or set GITHUB_TOKEN.",
    );
  throw new GitHubUrlError(`GitHub returned status ${lastStatus || "unknown"}`);
}
