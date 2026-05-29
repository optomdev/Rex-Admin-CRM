import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const bodySchema = z.object({
  rollout_status: z.enum(['not_started', 'scheduled', 'deployed', 'blocked', 'rolled_back']),
  scheduled_for: z.string().date().optional().nullable(),
  notes: z.string().trim().optional().nullable()
})

export default eventHandler(async (event) => {
  const rolloutId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!rolloutId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing rollout id' })
  }

  if (!isSupabaseConfigured()) {
    return {
      id: rolloutId,
      ...body,
      deployed_at: body.rollout_status === 'deployed' ? new Date().toISOString() : null,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const current = await supabase
    .from('customer_release_statuses')
    .select('id, customer_id, release_id, rollout_status, release:releases(version,title)')
    .eq('id', rolloutId)
    .single()

  if (current.error) {
    throw createError({ statusCode: 404, statusMessage: current.error.message })
  }

  const rollout = await supabase
    .from('customer_release_statuses')
    .update({
      rollout_status: body.rollout_status,
      scheduled_for: body.scheduled_for || null,
      deployed_at: body.rollout_status === 'deployed' ? new Date().toISOString() : null,
      notes: body.notes || null
    })
    .eq('id', rolloutId)
    .select('*, customer:customers(id,name), release:releases(id,version,title)')
    .single()

  if (rollout.error) {
    throw createError({ statusCode: 500, statusMessage: rollout.error.message })
  }

  const release = Array.isArray(current.data.release) ? current.data.release[0] : current.data.release

  if (body.rollout_status === 'deployed') {
    const deployment = await supabase
      .from('customer_deployments')
      .select('id, name')
      .eq('customer_id', current.data.customer_id)
      .order('is_primary', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (deployment.error) {
      throw createError({ statusCode: 500, statusMessage: deployment.error.message })
    }

    if (deployment.data) {
      const deploymentUpdate = await supabase
        .from('customer_deployments')
        .update({
          deployed_release_id: current.data.release_id,
          deployed_version: release?.version ?? null,
          status: 'active'
        })
        .eq('id', deployment.data.id)

      if (deploymentUpdate.error) {
        throw createError({ statusCode: 500, statusMessage: deploymentUpdate.error.message })
      }

      await supabase.from('customer_timeline_items').insert({
        customer_id: current.data.customer_id,
        item_type: 'deployment',
        title: 'Deployment version updated',
        body: `${deployment.data.name} now runs ${release?.version ?? release?.title ?? 'this release'}`,
        related_table: 'customer_deployments',
        related_id: deployment.data.id,
        metadata: {
          release_id: current.data.release_id,
          rollout_id: rolloutId,
          deployed_version: release?.version ?? null
        }
      })
    }
  }

  if (current.data.rollout_status !== body.rollout_status) {
    await supabase.from('customer_timeline_items').insert({
      customer_id: current.data.customer_id,
      item_type: 'release',
      title: `Release rollout ${body.rollout_status.replaceAll('_', ' ')}`,
      body: release?.version || release?.title || 'Rex release',
      related_table: 'customer_release_statuses',
      related_id: rolloutId,
      metadata: {
        release_id: current.data.release_id,
        previous_status: current.data.rollout_status,
        rollout_status: body.rollout_status
      }
    })
  }

  return rollout.data
})
