const GH_API = "https://api.github.com";
const UA = "TheLaunchFeedBot/1.0";

export type GitHubRepoInfo = {
  owner: string;
  name: string;
  htmlUrl: string;
  description: string | null;
  homepage: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  language: string | null;
  license: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  latestRelease: { tag: string; name: string; body: string; publishedAt: string | null } | null;
  readme: string;
  languages: { name: string; bytes: number; pct: number }[];
};

function parseRepoFromUrl(url: string): { owner: string; name: string } | null {
  try {
    const u = new URL(url);
    if (!/github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, rawName] = parts;
    const name = rawName.replace(/\.git$/i, "");
    if (!owner || !name) return null;
    return { owner, name };
  } catch {
    return null;
  }
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "user-agent": UA,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function ghJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${GH_API}${path}`, { headers: ghHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function ghText(path: string): Promise<string> {
  try {
    const res = await fetch(`${GH_API}${path}`, {
      headers: { ...ghHeaders(), accept: "application/vnd.github.raw" },
    });
    if (!res.ok) return "";
    const t = await res.text();
    return t.slice(0, 20_000);
  } catch {
    return "";
  }
}

export async function fetchGitHub(url: string): Promise<GitHubRepoInfo | null> {
  const repo = parseRepoFromUrl(url);
  if (!repo) return null;

  type RepoJson = {
    html_url: string;
    description: string | null;
    homepage: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    topics?: string[];
    language: string | null;
    license: { spdx_id?: string; name?: string } | null;
    created_at: string | null;
    updated_at: string | null;
  };
  type ReleaseJson = { tag_name: string; name: string; body: string | null; published_at: string | null };

  const [repoData, release, readme, langMap] = await Promise.all([
    ghJson<RepoJson>(`/repos/${repo.owner}/${repo.name}`),
    ghJson<ReleaseJson>(`/repos/${repo.owner}/${repo.name}/releases/latest`),
    ghText(`/repos/${repo.owner}/${repo.name}/readme`),
    ghJson<Record<string, number>>(`/repos/${repo.owner}/${repo.name}/languages`),
  ]);

  if (!repoData) return null;

  const totalBytes = langMap ? Object.values(langMap).reduce((a, b) => a + b, 0) : 0;
  const languages = langMap && totalBytes > 0
    ? Object.entries(langMap)
        .map(([name, bytes]) => ({ name, bytes, pct: (bytes / totalBytes) * 100 }))
        .sort((a, b) => b.bytes - a.bytes)
    : [];

  return {
    owner: repo.owner,
    name: repo.name,
    htmlUrl: repoData.html_url,
    description: repoData.description,
    homepage: repoData.homepage,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    openIssues: repoData.open_issues_count,
    topics: repoData.topics ?? [],
    language: repoData.language,
    license: repoData.license?.spdx_id ?? repoData.license?.name ?? null,
    createdAt: repoData.created_at,
    updatedAt: repoData.updated_at,
    latestRelease: release
      ? {
          tag: release.tag_name,
          name: release.name,
          body: (release.body ?? "").slice(0, 4000),
          publishedAt: release.published_at,
        }
      : null,
    readme,
    languages,
  };
}

export function isGitHubUrl(url: string): boolean {
  try {
    return /(^|\.)github\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}
