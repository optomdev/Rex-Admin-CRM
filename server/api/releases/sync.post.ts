import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

interface GitHubRelease {
  tag_name: string
  name: string | null
  body: string | null
  html_url: string
  published_at: string | null
  draft: boolean
  prerelease: boolean
}

interface GitHubTag {
  name: string
  commit: {
    sha: string
    url: string
  }
}

interface GitHubCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author?: {
      date?: string | null
    } | null
    committer?: {
      date?: string | null
    } | null
  }
}

interface ReleaseRow {
  version: string
  title: string
  release_notes: string | null
  published_at: string | null
  github_url: string | null
  github_payload: unknown
}

interface FetchErrorLike {
  status?: number
  statusCode?: number
  statusMessage?: string
  message?: string
  data?: {
    message?: string
  }
}

function parseGitHubRepo(config: ReturnType<typeof useRuntimeConfig>) {
  const configuredOwner = config.githubOwner?.trim()
  const configuredRepo = config.githubRepo?.trim()

  if (!configuredRepo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Set NUXT_GITHUB_REPO to your Rex repo name, owner/repo, or GitHub URL before syncing releases.'
    })
  }

  const repoUrlMatch = configuredRepo.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:[/?#].*)?$/i)
  if (repoUrlMatch) {
    return {
      owner: repoUrlMatch[1]!,
      repo: repoUrlMatch[2]!.replace(/\.git$/, '')
    }
  }

  if (configuredRepo.includes('/')) {
    const [owner, repo] = configuredRepo.split('/')
    if (owner && repo) {
      return {
        owner,
        repo: repo.replace(/\.git$/, '')
      }
    }
  }

  if (!configuredOwner) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Set NUXT_GITHUB_OWNER as well as NUXT_GITHUB_REPO, or set NUXT_GITHUB_REPO to owner/repo.'
    })
  }

  return {
    owner: configuredOwner,
    repo: configuredRepo.replace(/\.git$/, '')
  }
}

function githubSyncError(error: unknown, repoLabel: string, hasToken: boolean) {
  const fetchError = error as FetchErrorLike
  const status = fetchError?.statusCode || fetchError?.status
  const apiMessage = fetchError?.data?.message || fetchError?.statusMessage || fetchError?.message || 'GitHub release request failed.'

  if (status === 401) {
    return `GitHub rejected NUXT_GITHUB_TOKEN for ${repoLabel}. Create a token with read access to repository contents and paste it into .env.`
  }

  if (status === 403) {
    return `GitHub blocked release sync for ${repoLabel}. Check that NUXT_GITHUB_TOKEN has access to this private repository.`
  }

  if (status === 404) {
    return hasToken
      ? `GitHub could not find ${repoLabel}. Check the owner/repo values and confirm the token is allowed to access this private repo.`
      : `GitHub could not find ${repoLabel}. For a private repo, set NUXT_GITHUB_TOKEN with read access, then restart Nuxt.`
  }

  return `GitHub release sync failed for ${repoLabel}: ${apiMessage}`
}

async function fetchGitHub<T>(repoLabel: string, path: string, token?: string) {
  return await $fetch<T>(
    `https://api.github.com/repos/${repoLabel}${path}`,
    {
      headers: {
        'accept': 'application/vnd.github+json',
        'user-agent': 'rex-admin-crm',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    }
  )
}

function rowsFromReleases(releases: GitHubRelease[]): ReleaseRow[] {
  return releases
    .filter(release => !release.draft)
    .map(release => ({
      version: release.tag_name,
      title: release.name || release.tag_name,
      release_notes: release.body,
      published_at: release.published_at,
      github_url: release.html_url,
      github_payload: {
        source: 'release',
        ...release
      }
    }))
}

function rowsFromTags(repoLabel: string, tags: GitHubTag[]): ReleaseRow[] {
  return tags.map(tag => ({
    version: tag.name,
    title: `Tag ${tag.name}`,
    release_notes: `Git tag pointing to commit ${tag.commit.sha.slice(0, 7)}.`,
    published_at: null,
    github_url: `https://github.com/${repoLabel}/tree/${encodeURIComponent(tag.name)}`,
    github_payload: {
      source: 'tag',
      ...tag
    }
  }))
}

function rowsFromCommits(commits: GitHubCommit[]): ReleaseRow[] {
  return commits.map((commit) => {
    const [title, ...body] = commit.commit.message.split('\n')

    return {
      version: `commit-${commit.sha.slice(0, 7)}`,
      title: title || `Commit ${commit.sha.slice(0, 7)}`,
      release_notes: body.join('\n').trim() || commit.commit.message,
      published_at: commit.commit.author?.date || commit.commit.committer?.date || null,
      github_url: commit.html_url,
      github_payload: {
        source: 'commit',
        ...commit
      }
    }
  })
}

export default eventHandler(async () => {
  const config = useRuntimeConfig()
  const githubRepo = parseGitHubRepo(config)
  const repoLabel = `${githubRepo.owner}/${githubRepo.repo}`

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      simulated: true,
      imported: 0,
      message: 'Supabase is not configured, so the GitHub sync was not persisted.'
    }
  }

  let rows: ReleaseRow[] = []
  let source = 'releases'

  try {
    const encodedRepoLabel = `${encodeURIComponent(githubRepo.owner)}/${encodeURIComponent(githubRepo.repo)}`
    const releases = await fetchGitHub<GitHubRelease[]>(encodedRepoLabel, '/releases?per_page=50', config.githubToken)
    rows = Array.isArray(releases) ? rowsFromReleases(releases) : []

    if (!rows.length) {
      source = 'tags'
      const tags = await fetchGitHub<GitHubTag[]>(encodedRepoLabel, '/tags?per_page=50', config.githubToken)
      rows = Array.isArray(tags) ? rowsFromTags(repoLabel, tags) : []
    }

    if (!rows.length) {
      source = 'commits'
      const commits = await fetchGitHub<GitHubCommit[]>(encodedRepoLabel, '/commits?per_page=20', config.githubToken)
      rows = Array.isArray(commits) ? rowsFromCommits(commits) : []
    }
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: githubSyncError(error, repoLabel, Boolean(config.githubToken))
    })
  }

  if (!rows.length) {
    return {
      ok: true,
      imported: 0,
      message: `No GitHub releases, tags, or commits found for ${repoLabel}.`
    }
  }

  const { data, error } = await serverSupabase()
    .from('releases')
    .upsert(rows, { onConflict: 'version' })
    .select('id, version')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    ok: true,
    imported: data?.length ?? 0,
    message: `${data?.length ?? 0} GitHub ${source} imported or updated.`,
    releases: data
  }
})
