import { z } from 'zod'
import { complianceOnboardingTasks } from '../utils/onboardingChecklist'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

const onboardingSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().min(2),
  status: z.enum(['planning', 'in_progress', 'ready_for_go_live', 'live', 'blocked', 'paused']).default('planning'),
  go_live_target: z.string().date().optional().nullable(),
  readiness_score: z.coerce.number().int().min(0).max(100).default(0),
  blockers: z.string().trim().optional().nullable(),
  training_notes: z.string().trim().optional().nullable()
})

export default eventHandler(async (event) => {
  const body = onboardingSchema.parse(await readBody(event))

  if (!isSupabaseConfigured()) {
    return {
      id: crypto.randomUUID(),
      ...body,
      go_live_target: body.go_live_target || null,
      blockers: body.blockers || null,
      training_notes: body.training_notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  const supabase = serverSupabase()

  const project = await supabase
    .from('onboarding_projects')
    .insert({
      customer_id: body.customer_id,
      name: body.name,
      status: body.status,
      go_live_target: body.go_live_target || null,
      readiness_score: body.readiness_score,
      blockers: body.blockers || null,
      training_notes: body.training_notes || null
    })
    .select('*, customer:customers(id,name)')
    .single()

  if (project.error) {
    throw createError({ statusCode: 500, statusMessage: project.error.message })
  }

  const taskRows = complianceOnboardingTasks.map((task, index) => ({
    project_id: project.data.id,
    title: task.title,
    description: task.description,
    status: index === 0 ? 'doing' : 'todo',
    sort_order: index + 1
  }))

  const tasks = await supabase
    .from('onboarding_tasks')
    .insert(taskRows)

  if (tasks.error) {
    throw createError({ statusCode: 500, statusMessage: tasks.error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: body.customer_id,
    item_type: 'onboarding',
    title: 'Onboarding project created',
    body: body.name,
    related_table: 'onboarding_projects',
    related_id: project.data.id,
    metadata: {
      status: body.status,
      go_live_target: body.go_live_target || null,
      generated_tasks: complianceOnboardingTasks.length
    }
  })

  if (body.status !== 'planning') {
    await supabase
      .from('customers')
      .update({ status: 'onboarding' })
      .eq('id', body.customer_id)
      .in('status', ['prospect', 'active'])
  }

  return project.data
})
