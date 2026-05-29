import { serverSupabaseUser } from '#supabase/server'

const publicApiPaths = [
  '/api/webhooks/rex'
]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/') || publicApiPaths.some(publicPath => path.startsWith(publicPath))) {
    return
  }

  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }
})
