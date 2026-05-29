import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

export default eventHandler(async (event) => {
  const deploymentId = getRouterParam(event, 'id')

  if (!deploymentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing deployment id' })
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, simulated: true }
  }

  const supabase = serverSupabase()
  const existing = await supabase
    .from('customer_deployments')
    .select('*')
    .eq('id', deploymentId)
    .single()

  if (existing.error) {
    throw createError({ statusCode: 404, statusMessage: existing.error.message })
  }

  const { error } = await supabase
    .from('customer_deployments')
    .delete()
    .eq('id', deploymentId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  let promoted = null

  if (existing.data.is_primary) {
    const replacement = await supabase
      .from('customer_deployments')
      .select('*')
      .eq('customer_id', existing.data.customer_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (replacement.error) {
      throw createError({ statusCode: 500, statusMessage: replacement.error.message })
    }

    if (replacement.data) {
      const update = await supabase
        .from('customer_deployments')
        .update({ is_primary: true })
        .eq('id', replacement.data.id)
        .select('*')
        .single()

      if (update.error) {
        throw createError({ statusCode: 500, statusMessage: update.error.message })
      }

      promoted = update.data

      await supabase
        .from('customers')
        .update({
          customer_identifier: update.data.customer_identifier,
          rex_project_ref: update.data.rex_project_ref,
          rex_supabase_url: update.data.supabase_url
        })
        .eq('id', existing.data.customer_id)
    } else {
      await supabase
        .from('customers')
        .update({
          customer_identifier: null,
          rex_project_ref: null,
          rex_supabase_url: null
        })
        .eq('id', existing.data.customer_id)
    }
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: existing.data.customer_id,
    item_type: 'deployment',
    title: 'Deployment removed',
    body: existing.data.name,
    related_table: 'customer_deployments',
    metadata: {
      rex_project_ref: existing.data.rex_project_ref,
      promoted_deployment_id: promoted?.id ?? null
    }
  })

  return { ok: true, promoted }
})
