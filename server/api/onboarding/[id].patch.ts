import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const projectStatuses = ['planning', 'in_progress', 'ready_for_go_live', 'live', 'blocked', 'paused'] as const

const bodySchema = z.object({
  status: z.enum(projectStatuses).optional(),
  go_live_target: z.string().date().optional().nullable(),
  blockers: z.string().trim().optional().nullable(),
  training_notes: z.string().trim().optional().nullable()
})

type ProjectUpdate = z.output<typeof bodySchema>
type ProjectField = keyof ProjectUpdate

function changedFields(current: Record<ProjectField, unknown>, body: ProjectUpdate) {
  return (Object.entries(body) as [ProjectField, unknown][])
    .filter(([key, value]) => current[key] !== value)
}

export default eventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing onboarding project id' })
  }

  if (!Object.keys(body).length) {
    throw createError({ statusCode: 400, statusMessage: 'No onboarding fields supplied' })
  }

  if (!isSupabaseConfigured()) {
    return {
      id: projectId,
      ...body,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const current = await supabase
    .from('onboarding_projects')
    .select('id, customer_id, name, status, go_live_target, blockers, training_notes')
    .eq('id', projectId)
    .single()

  if (current.error) {
    throw createError({ statusCode: 404, statusMessage: current.error.message })
  }

  const normalizedBody: ProjectUpdate = {}

  if ('status' in body) normalizedBody.status = body.status
  if ('go_live_target' in body) normalizedBody.go_live_target = body.go_live_target || null
  if ('blockers' in body) normalizedBody.blockers = body.blockers?.trim() || null
  if ('training_notes' in body) normalizedBody.training_notes = body.training_notes?.trim() || null

  const currentProject = {
    status: current.data.status,
    go_live_target: current.data.go_live_target,
    blockers: current.data.blockers,
    training_notes: current.data.training_notes
  }

  const changes = changedFields(currentProject, normalizedBody)

  if (!changes.length) {
    return current.data
  }

  const project = await supabase
    .from('onboarding_projects')
    .update(normalizedBody)
    .eq('id', projectId)
    .select('*, customer:customers(id,name)')
    .single()

  if (project.error) {
    throw createError({ statusCode: 500, statusMessage: project.error.message })
  }

  const details = {
    changes: Object.fromEntries(changes.map(([key, value]) => [
      key,
      {
        from: currentProject[key],
        to: value
      }
    ]))
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: current.data.customer_id,
    item_type: 'onboarding',
    title: 'Onboarding details updated',
    body: current.data.name,
    related_table: 'onboarding_projects',
    related_id: current.data.id,
    metadata: details
  })

  if (normalizedBody.status === 'live') {
    await supabase
      .from('customers')
      .update({ status: 'active' })
      .eq('id', current.data.customer_id)
      .in('status', ['prospect', 'onboarding', 'at_risk', 'paused'])
  } else if (normalizedBody.status && ['planning', 'in_progress', 'ready_for_go_live', 'blocked'].includes(normalizedBody.status)) {
    await supabase
      .from('customers')
      .update({ status: 'onboarding' })
      .eq('id', current.data.customer_id)
      .in('status', ['prospect', 'active'])
  }

  return project.data
})
