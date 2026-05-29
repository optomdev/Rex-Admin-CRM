import { serverSupabaseUser } from '#supabase/server'
import { extname } from 'node:path'
import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../../utils/supabase'

const bucketId = 'rex-compliance-evidence'
const evidenceTypes = ['source_document', 'supporting_evidence', 'review_note', 'screenshot', 'signed_approval'] as const
const evidenceTypeSchema = z.enum(evidenceTypes).default('supporting_evidence')
const contentTypes: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain'
}

function safeFilename(filename: string) {
  return filename
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'evidence-file'
}

export default eventHandler(async (event) => {
  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing compliance document id' })
  }

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file' && part.filename && part.data?.length)

  if (!file?.filename || !file.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Upload a file' })
  }

  const evidenceTypePart = form?.find(part => part.name === 'evidence_type')
  const notesPart = form?.find(part => part.name === 'notes')
  const evidenceType = evidenceTypeSchema.parse(evidenceTypePart?.data?.toString() || 'supporting_evidence')
  const notes = notesPart?.data?.toString().trim() || null
  const originalFilename = safeFilename(file.filename)
  const contentType = file.type || contentTypes[extname(originalFilename).toLowerCase()] || 'text/plain'

  if (!isSupabaseConfigured()) {
    return {
      id: crypto.randomUUID(),
      document_id: documentId,
      bucket_id: bucketId,
      storage_path: `${documentId}/${originalFilename}`,
      original_filename: originalFilename,
      content_type: contentType,
      size_bytes: file.data.length,
      evidence_type: evidenceType,
      notes,
      uploaded_at: new Date().toISOString(),
      simulated: true
    }
  }

  const user = await serverSupabaseUser(event)
  const supabase = serverSupabase()
  const storagePath = `${documentId}/${Date.now()}-${crypto.randomUUID()}-${originalFilename}`

  const upload = await supabase.storage
    .from(bucketId)
    .upload(storagePath, file.data, {
      contentType,
      upsert: false
    })

  if (upload.error) {
    throw createError({ statusCode: 500, statusMessage: upload.error.message })
  }

  const { data, error } = await supabase
    .from('internal_compliance_evidence_files')
    .insert({
      document_id: documentId,
      bucket_id: bucketId,
      storage_path: storagePath,
      original_filename: originalFilename,
      content_type: contentType,
      size_bytes: file.data.length,
      evidence_type: evidenceType,
      notes,
      uploaded_by: user?.id ?? null
    })
    .select('*')
    .single()

  if (error) {
    await supabase.storage.from(bucketId).remove([storagePath])
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
