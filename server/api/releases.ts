import { sampleReleases } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleReleases
  }

  const supabase = serverSupabase()
  const [releases, deployments] = await Promise.all([
    supabase
      .from('releases')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('customer_deployments')
      .select('*, customer:customers(id,name,account_type,status,health_score), release:releases(id,version,title)')
      .or('deployed_release_id.not.is.null,deployed_version.not.is.null,git_tag.not.is.null,git_commit.not.is.null')
      .order('updated_at', { ascending: false })
  ])

  const firstError = [releases, deployments].find(result => result.error)?.error
  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message })
  }

  return (releases.data ?? []).map(release => ({
    ...release,
    deployments: (deployments.data ?? []).filter((deployment) => {
      return deployment.deployed_release_id === release.id
        || deployment.deployed_version === release.version
        || deployment.git_tag === release.version
    })
  }))
})
