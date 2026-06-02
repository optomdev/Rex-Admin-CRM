import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const bucketId = 'rex-compliance-evidence'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return {
      deleted: 0,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const { data: sourceFiles, error } = await supabase
    .from('internal_compliance_evidence_files')
    .select('storage_path')
    .eq('bucket_id', bucketId)
    .eq('evidence_type', 'source_document')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const paths = sourceFiles?.map(file => file.storage_path) ?? []

  if (paths.length) {
    const removed = await supabase.storage.from(bucketId).remove(paths)

    if (removed.error) {
      throw createError({ statusCode: 500, statusMessage: removed.error.message })
    }
  }

  const deleted = await supabase
    .from('internal_compliance_evidence_files')
    .delete()
    .eq('bucket_id', bucketId)
    .eq('evidence_type', 'source_document')

  if (deleted.error) {
    throw createError({ statusCode: 500, statusMessage: deleted.error.message })
  }

  return {
    deleted: paths.length
  }
})
