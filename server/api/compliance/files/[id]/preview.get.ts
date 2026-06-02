import { isSupabaseConfigured, serverSupabase } from '../../../../utils/supabase'

type PreviewKind = 'text' | 'image' | 'download'

function getPreviewKind(filename: string, contentType?: string | null): PreviewKind {
  const lowerFilename = filename.toLowerCase()
  const mime = contentType?.toLowerCase() ?? ''

  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(lowerFilename)) {
    return 'image'
  }

  if (mime.startsWith('text/') || lowerFilename.endsWith('.md') || lowerFilename.endsWith('.txt')) {
    return 'text'
  }

  return 'download'
}

export default eventHandler(async (event) => {
  const fileId = getRouterParam(event, 'id')

  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing compliance evidence file id' })
  }

  if (!isSupabaseConfigured()) {
    return {
      kind: 'download' as const,
      filename: 'preview-unavailable',
      signed_url: null,
      simulated: true
    }
  }

  const supabase = serverSupabase()
  const file = await supabase
    .from('internal_compliance_evidence_files')
    .select('bucket_id, storage_path, original_filename, content_type')
    .eq('id', fileId)
    .single()

  if (file.error) {
    throw createError({ statusCode: 404, statusMessage: file.error.message })
  }

  const kind = getPreviewKind(file.data.original_filename, file.data.content_type)

  const signed = await supabase.storage
    .from(file.data.bucket_id)
    .createSignedUrl(file.data.storage_path, 60 * 5)

  if (signed.error) {
    throw createError({ statusCode: 500, statusMessage: signed.error.message })
  }

  if (kind !== 'text') {
    return {
      kind,
      filename: file.data.original_filename,
      content_type: file.data.content_type,
      signed_url: signed.data.signedUrl
    }
  }

  const downloaded = await supabase.storage
    .from(file.data.bucket_id)
    .download(file.data.storage_path)

  if (downloaded.error) {
    throw createError({ statusCode: 500, statusMessage: downloaded.error.message })
  }

  const content = Buffer.from(await downloaded.data.arrayBuffer()).toString('utf8')

  return {
    kind,
    filename: file.data.original_filename,
    content_type: file.data.content_type,
    signed_url: signed.data.signedUrl,
    content
  }
})
