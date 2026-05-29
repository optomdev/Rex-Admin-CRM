import { isSupabaseConfigured, serverSupabase } from '../../../../utils/supabase'

export default eventHandler(async (event) => {
  const fileId = getRouterParam(event, 'id')

  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing compliance evidence file id' })
  }

  if (!isSupabaseConfigured()) {
    return {
      signed_url: null,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const file = await supabase
    .from('internal_compliance_evidence_files')
    .select('bucket_id, storage_path')
    .eq('id', fileId)
    .single()

  if (file.error) {
    throw createError({ statusCode: 404, statusMessage: file.error.message })
  }

  const signed = await supabase.storage
    .from(file.data.bucket_id)
    .createSignedUrl(file.data.storage_path, 60 * 5)

  if (signed.error) {
    throw createError({ statusCode: 500, statusMessage: signed.error.message })
  }

  return {
    signed_url: signed.data.signedUrl
  }
})
