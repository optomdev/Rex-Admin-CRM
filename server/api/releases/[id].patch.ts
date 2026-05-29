import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const bodySchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  release_notes: z.string().trim().optional().nullable(),
  known_issues: z.string().trim().optional().nullable(),
  published_at: z.string().trim().optional().nullable(),
  github_url: z.string().trim().url().optional().nullable()
})

export default eventHandler(async (event) => {
  const releaseId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!releaseId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing release id' })
  }

  if (!Object.keys(body).length) {
    throw createError({ statusCode: 400, statusMessage: 'No release fields supplied' })
  }

  const normalized = {
    ...('title' in body ? { title: body.title } : {}),
    ...('release_notes' in body ? { release_notes: body.release_notes?.trim() || null } : {}),
    ...('known_issues' in body ? { known_issues: body.known_issues?.trim() || null } : {}),
    ...('published_at' in body ? { published_at: body.published_at || null } : {}),
    ...('github_url' in body ? { github_url: body.github_url?.trim() || null } : {})
  }

  if (!isSupabaseConfigured()) {
    return {
      id: releaseId,
      ...normalized,
      simulated: true
    }
  }

  const { data, error } = await serverSupabase()
    .from('releases')
    .update(normalized)
    .eq('id', releaseId)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
