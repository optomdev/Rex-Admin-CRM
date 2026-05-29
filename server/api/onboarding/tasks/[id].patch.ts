import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const bodySchema = z.object({
  status: z.enum(['todo', 'doing', 'done', 'blocked'])
})

function nextProjectStatus(taskStatuses: string[], currentStatus: string) {
  if (currentStatus === 'live' || currentStatus === 'paused') return currentStatus
  if (taskStatuses.includes('blocked')) return 'blocked'
  if (taskStatuses.length > 0 && taskStatuses.every(status => status === 'done')) return 'ready_for_go_live'
  if (taskStatuses.some(status => ['doing', 'done'].includes(status))) return 'in_progress'
  return 'planning'
}

export default eventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!taskId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing onboarding task id' })
  }

  if (!isSupabaseConfigured()) {
    return {
      task: {
        id: taskId,
        status: body.status
      },
      project: null,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const task = await supabase
    .from('onboarding_tasks')
    .update({ status: body.status })
    .eq('id', taskId)
    .select('*')
    .single()

  if (task.error) {
    throw createError({ statusCode: 500, statusMessage: task.error.message })
  }

  const projectTasks = await supabase
    .from('onboarding_tasks')
    .select('status')
    .eq('project_id', task.data.project_id)

  if (projectTasks.error) {
    throw createError({ statusCode: 500, statusMessage: projectTasks.error.message })
  }

  const taskStatuses = projectTasks.data?.map(item => item.status) ?? []
  const completedCount = taskStatuses.filter(status => status === 'done').length
  const readinessScore = taskStatuses.length
    ? Math.round((completedCount / taskStatuses.length) * 100)
    : 0

  const currentProject = await supabase
    .from('onboarding_projects')
    .select('id, customer_id, status')
    .eq('id', task.data.project_id)
    .single()

  if (currentProject.error) {
    throw createError({ statusCode: 500, statusMessage: currentProject.error.message })
  }

  const projectStatus = nextProjectStatus(taskStatuses, currentProject.data.status)
  const project = await supabase
    .from('onboarding_projects')
    .update({
      readiness_score: readinessScore,
      status: projectStatus
    })
    .eq('id', task.data.project_id)
    .select('*, customer:customers(id,name)')
    .single()

  if (project.error) {
    throw createError({ statusCode: 500, statusMessage: project.error.message })
  }

  await supabase.from('customer_timeline_items').insert({
    customer_id: currentProject.data.customer_id,
    item_type: 'onboarding',
    title: `Checklist task marked ${body.status}`,
    body: task.data.title,
    related_table: 'onboarding_tasks',
    related_id: task.data.id,
    metadata: {
      project_id: task.data.project_id,
      readiness_score: readinessScore,
      project_status: projectStatus
    }
  })

  return {
    task: task.data,
    project: project.data
  }
})
