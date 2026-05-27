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

export default eventHandler(async () => {
  const config = useRuntimeConfig()

  if (!config.githubOwner || !config.githubRepo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Set NUXT_GITHUB_OWNER and NUXT_GITHUB_REPO before syncing releases.'
    })
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      simulated: true,
      imported: 0,
      message: 'Supabase is not configured, so the GitHub sync was not persisted.'
    }
  }

  const releases = await $fetch<GitHubRelease[]>(
    `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}/releases`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        ...(config.githubToken ? { authorization: `Bearer ${config.githubToken}` } : {})
      }
    }
  )

  const rows = releases
    .filter(release => !release.draft)
    .map(release => ({
      version: release.tag_name,
      title: release.name || release.tag_name,
      release_notes: release.body,
      published_at: release.published_at,
      github_url: release.html_url,
      github_payload: release
    }))

  if (!rows.length) {
    return {
      ok: true,
      imported: 0
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
    releases: data
  }
})
