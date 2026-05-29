import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const deploymentSchema = z.object({
  name: z.string().trim().min(2),
  environment: z.enum(['demo', 'staging', 'production', 'training']),
  status: z.enum(['provisioning', 'active', 'maintenance', 'paused', 'retired', 'error']),
  health_status: z.enum(['unknown', 'healthy', 'degraded', 'down']),
  customer_identifier: z.string().trim().optional().nullable(),
  rex_project_ref: z.string().trim().optional().nullable(),
  supabase_url: z.string().trim().url().optional().or(z.literal('')).nullable(),
  app_url: z.string().trim().url().optional().or(z.literal('')).nullable(),
  region: z.string().trim().optional().nullable(),
  deployed_release_id: z.string().uuid().optional().or(z.literal('')).nullable(),
  deployed_version: z.string().trim().optional().nullable(),
  last_seen_at: z.string().datetime().optional().or(z.literal('')).nullable(),
  is_primary: z.boolean(),
  notes: z.string().trim().optional().nullable()
})

export default eventHandler(async (event) => {
  const deploymentId = getRouterParam(event, 'id')
  const body = deploymentSchema.parse(await readBody(event))

  if (!deploymentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing deployment id' })
  }

  const payload = {
    name: body.name,
    environment: body.environment,
    status: body.status,
    health_status: body.health_status,
    customer_identifier: body.customer_identifier || null,
    rex_project_ref: body.rex_project_ref || null,
    supabase_url: body.supabase_url || null,
    app_url: body.app_url || null,
    region: body.region || null,
    deployed_release_id: body.deployed_release_id || null,
    deployed_version: body.deployed_version || null,
    last_seen_at: body.last_seen_at || null,
    is_primary: body.is_primary,
    notes: body.notes || null
  }

  if (!isSupabaseConfigured()) {
    return {
      id: deploymentId,
      ...payload,
      updated_at: new Date().toISOString(),
      simulated: true
    }
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

  if (payload.is_primary) {
    await supabase
      .from('customer_deployments')
      .update({ is_primary: false })
      .eq('customer_id', existing.data.customer_id)
      .neq('id', deploymentId)
  }

  const { data, error } = await supabase
    .from('customer_deployments')
    .update(payload)
    .eq('id', deploymentId)
    .select('*, release:releases(id,version,title)')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (data.is_primary) {
    await supabase
      .from('customers')
      .update({
        customer_identifier: data.customer_identifier,
        rex_project_ref: data.rex_project_ref,
        rex_supabase_url: data.supabase_url
      })
      .eq('id', data.customer_id)
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: data.customer_id,
    item_type: 'deployment',
    title: 'Deployment updated',
    body: `${data.name} (${data.environment})`,
    related_table: 'customer_deployments',
    related_id: data.id,
    metadata: {
      status: data.status,
      health_status: data.health_status,
      rex_project_ref: data.rex_project_ref,
      was_primary: existing.data.is_primary,
      is_primary: data.is_primary
    }
  })

  return data
})
