import { z } from 'zod'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const documentStatuses = ['not_started', 'draft', 'evidence_pending', 'ready_for_review', 'approved', 'blocked'] as const

const bodySchema = z.object({
  document_status: z.enum(documentStatuses).optional(),
  owner: z.string().trim().min(1).optional(),
  due_date: z.string().date().optional().nullable(),
  evidence_required: z.string().trim().min(1).optional(),
  residual_risk: z.string().trim().min(1).optional(),
  go_live_blocker: z.boolean().optional(),
  notes: z.string().trim().optional().nullable()
}).refine(body => Object.keys(body).length > 0, {
  message: 'No compliance document fields supplied'
})

export default eventHandler(async (event) => {
  const documentId = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  if (!documentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing compliance document id' })
  }

  if (!isSupabaseConfigured()) {
    return {
      id: documentId,
      ...body,
      simulated: true
    }
  }

  const updateBody: Record<string, string | boolean | null> = {}

  if ('document_status' in body) updateBody.document_status = body.document_status!
  if ('owner' in body) updateBody.owner = body.owner!
  if ('due_date' in body) updateBody.due_date = body.due_date || null
  if ('evidence_required' in body) updateBody.evidence_required = body.evidence_required!
  if ('residual_risk' in body) updateBody.residual_risk = body.residual_risk!
  if ('go_live_blocker' in body) updateBody.go_live_blocker = body.go_live_blocker!
  if ('notes' in body) updateBody.notes = body.notes?.trim() || null

  const { data, error } = await serverSupabase()
    .from('internal_compliance_documents')
    .update(updateBody)
    .eq('id', documentId)
    .select('*, files:internal_compliance_evidence_files(*)')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
