import { complianceOnboardingTasks } from '../../utils/onboardingChecklist'
import { sampleOnboarding } from '../../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

export default eventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')

  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing onboarding project id' })
  }

  if (!isSupabaseConfigured()) {
    const project = sampleOnboarding.find(item => item.id === projectId)

    if (!project) {
      throw createError({ statusCode: 404, statusMessage: 'Onboarding project not found' })
    }

    return {
      project,
      tasks: complianceOnboardingTasks.map((task, index) => ({
        id: `${projectId}-task-${index + 1}`,
        project_id: projectId,
        title: task.title,
        description: task.description,
        status: index === 0 ? 'doing' : 'todo',
        owner: null,
        due_date: null,
        sort_order: index + 1
      }))
    }
  }

  const supabase = serverSupabase()
  const [project, tasks] = await Promise.all([
    supabase
      .from('onboarding_projects')
      .select('*, customer:customers(id,name)')
      .eq('id', projectId)
      .single(),
    supabase
      .from('onboarding_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
  ])

  if (project.error) {
    throw createError({ statusCode: 404, statusMessage: project.error.message })
  }

  if (tasks.error) {
    throw createError({ statusCode: 500, statusMessage: tasks.error.message })
  }

  return {
    project: project.data,
    tasks: tasks.data ?? []
  }
})
