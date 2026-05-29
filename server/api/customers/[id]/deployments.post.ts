import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const optionalTimestamp = z.string().trim().optional().nullable()

const deploymentSchema = z.object({
  name: z.string().trim().min(2),
  environment: z.enum(['demo', 'staging', 'production', 'training']).default('production'),
  status: z.enum(['provisioning', 'active', 'maintenance', 'paused', 'retired', 'error']).default('active'),
  health_status: z.enum(['unknown', 'healthy', 'degraded', 'down']).default('unknown'),
  customer_identifier: z.string().trim().optional().nullable(),
  rex_project_ref: z.string().trim().optional().nullable(),
  supabase_url: z.string().trim().url().optional().or(z.literal('')).nullable(),
  app_url: z.string().trim().url().optional().or(z.literal('')).nullable(),
  region: z.string().trim().optional().nullable(),
  deployed_release_id: z.string().uuid().optional().or(z.literal('')).nullable(),
  deployed_version: z.string().trim().optional().nullable(),
  app_provider: z.string().trim().optional().nullable(),
  app_provider_project: z.string().trim().optional().nullable(),
  git_repo: z.string().trim().optional().nullable(),
  git_branch: z.string().trim().optional().nullable(),
  git_tag: z.string().trim().optional().nullable(),
  git_commit: z.string().trim().optional().nullable(),
  latest_migration_version: z.string().trim().optional().nullable(),
  latest_migration_name: z.string().trim().optional().nullable(),
  edge_functions_commit: z.string().trim().optional().nullable(),
  deploy_status: z.enum(['unknown', 'building', 'deployed', 'failed', 'rolled_back']).default('unknown'),
  last_deployed_at: optionalTimestamp,
  last_smoke_tested_at: optionalTimestamp,
  last_seen_at: optionalTimestamp,
  is_primary: z.boolean().default(false),
  notes: z.string().trim().optional().nullable()
})

function normalizeTimestamp(value: string | null | undefined, field: string) {
  if (!value) return null

  const candidate = value
    .trim()
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2')

  const date = new Date(candidate)

  if (Number.isNaN(date.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: `${field} must be a valid date/time.`
    })
  }

  return date.toISOString()
}

export default eventHandler(async (event) => {
  const customerId = getRouterParam(event, 'id')
  const body = deploymentSchema.parse(await readBody(event))

  if (!customerId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing customer id' })
  }

  const payload = {
    customer_id: customerId,
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
    app_provider: body.app_provider || null,
    app_provider_project: body.app_provider_project || null,
    git_repo: body.git_repo || null,
    git_branch: body.git_branch || null,
    git_tag: body.git_tag || null,
    git_commit: body.git_commit || null,
    latest_migration_version: body.latest_migration_version || null,
    latest_migration_name: body.latest_migration_name || null,
    edge_functions_commit: body.edge_functions_commit || null,
    deploy_status: body.deploy_status,
    last_deployed_at: normalizeTimestamp(body.last_deployed_at, 'Last deployed at'),
    last_smoke_tested_at: normalizeTimestamp(body.last_smoke_tested_at, 'Smoke tested at'),
    last_seen_at: normalizeTimestamp(body.last_seen_at, 'Last seen at'),
    is_primary: body.is_primary,
    notes: body.notes || null
  }

  if (!isSupabaseConfigured()) {
    return {
      id: crypto.randomUUID(),
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  const supabase = serverSupabase()
  const existing = await supabase
    .from('customer_deployments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)

  if (existing.error) {
    throw createError({ statusCode: 500, statusMessage: existing.error.message })
  }

  const shouldBePrimary = payload.is_primary || existing.count === 0

  if (shouldBePrimary) {
    await supabase
      .from('customer_deployments')
      .update({ is_primary: false })
      .eq('customer_id', customerId)
  }

  const { data, error } = await supabase
    .from('customer_deployments')
    .insert({ ...payload, is_primary: shouldBePrimary })
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
      .eq('id', customerId)
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: customerId,
    item_type: 'deployment',
    title: 'Deployment added',
    body: `${data.name} (${data.environment})`,
    related_table: 'customer_deployments',
    related_id: data.id,
    metadata: {
      status: data.status,
      health_status: data.health_status,
      rex_project_ref: data.rex_project_ref,
      app_provider: data.app_provider,
      git_branch: data.git_branch,
      git_tag: data.git_tag,
      git_commit: data.git_commit,
      latest_migration_version: data.latest_migration_version,
      is_primary: data.is_primary
    }
  })

  return data
})
