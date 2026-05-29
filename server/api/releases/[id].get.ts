import { sampleCustomers, sampleReleases } from '../../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

export default eventHandler(async (event) => {
  const releaseId = getRouterParam(event, 'id')

  if (!releaseId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing release id' })
  }

  if (!isSupabaseConfigured()) {
    const release = sampleReleases.find(item => item.id === releaseId)

    if (!release) {
      throw createError({ statusCode: 404, statusMessage: 'Release not found' })
    }

    return {
      release,
      deployments: [],
      rollouts: sampleCustomers.map(customer => ({
        id: `${releaseId}-${customer.id}`,
        customer_id: customer.id,
        release_id: releaseId,
        rollout_status: 'not_started',
        scheduled_for: null,
        deployed_at: null,
        notes: null,
        customer: {
          id: customer.id,
          name: customer.name
        },
        release: {
          id: release.id,
          version: release.version,
          title: release.title
        }
      }))
    }
  }

  const supabase = serverSupabase()
  const release = await supabase
    .from('releases')
    .select('*')
    .eq('id', releaseId)
    .single()

  if (release.error) {
    throw createError({ statusCode: 404, statusMessage: release.error.message })
  }

  const [customers, existingRollouts, deployments] = await Promise.all([
    supabase
      .from('customers')
      .select('id')
      .order('name', { ascending: true }),
    supabase
      .from('customer_release_statuses')
      .select('customer_id')
      .eq('release_id', releaseId),
    supabase
      .from('customer_deployments')
      .select('*, customer:customers(id,name,account_type,status,health_score), release:releases(id,version,title)')
      .or(`deployed_release_id.eq.${releaseId},deployed_version.eq.${release.data.version},git_tag.eq.${release.data.version}`)
      .order('updated_at', { ascending: false })
  ])

  const firstError = [customers, existingRollouts, deployments].find(result => result.error)?.error
  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message })
  }

  const existingCustomerIds = new Set(existingRollouts.data?.map(item => item.customer_id) ?? [])
  const missingRows = (customers.data ?? [])
    .filter(customer => !existingCustomerIds.has(customer.id))
    .map(customer => ({
      customer_id: customer.id,
      release_id: releaseId,
      rollout_status: 'not_started'
    }))

  if (missingRows.length) {
    const inserted = await supabase
      .from('customer_release_statuses')
      .insert(missingRows)

    if (inserted.error) {
      throw createError({ statusCode: 500, statusMessage: inserted.error.message })
    }
  }

  const rollouts = await supabase
    .from('customer_release_statuses')
    .select('*, customer:customers(id,name), release:releases(id,version,title)')
    .eq('release_id', releaseId)
    .order('rollout_status', { ascending: true })

  if (rollouts.error) {
    throw createError({ statusCode: 500, statusMessage: rollouts.error.message })
  }

  return {
    release: release.data,
    rollouts: rollouts.data ?? [],
    deployments: deployments.data ?? []
  }
})
