import { internalComplianceDocuments } from '../utils/complianceTracker'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

function seedRows() {
  return internalComplianceDocuments.map(document => ({
    id: document.id,
    document_no: document.document_no,
    title: document.title,
    source_status: document.source_status,
    document_status: document.document_status,
    owner: document.owner,
    due_date: document.due_date,
    evidence_required: document.evidence_required,
    residual_risk: document.residual_risk,
    go_live_blocker: document.go_live_blocker,
    source_folder_path: document.section_path,
    source_markdown_path: document.markdown_path,
    source_word_path: document.word_path,
    sort_order: document.sort_order
  }))
}

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return internalComplianceDocuments.map(document => ({
      ...document,
      source_folder_path: document.section_path,
      source_markdown_path: document.markdown_path,
      source_word_path: document.word_path,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      files: []
    }))
  }

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('internal_compliance_documents')
    .select('*, files:internal_compliance_evidence_files(*)')
    .order('sort_order', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data?.length) {
    const seed = await supabase
      .from('internal_compliance_documents')
      .upsert(seedRows(), { onConflict: 'id', ignoreDuplicates: true })

    if (seed.error) {
      throw createError({ statusCode: 500, statusMessage: seed.error.message })
    }

    const seeded = await supabase
      .from('internal_compliance_documents')
      .select('*, files:internal_compliance_evidence_files(*)')
      .order('sort_order', { ascending: true })

    if (seeded.error) {
      throw createError({ statusCode: 500, statusMessage: seeded.error.message })
    }

    return seeded.data ?? []
  }

  return data.map(document => ({
    ...document,
    files: [...(document.files ?? [])].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
  }))
})
