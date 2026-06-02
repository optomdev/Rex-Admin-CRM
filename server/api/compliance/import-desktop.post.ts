import { serverSupabaseUser } from '#supabase/server'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, relative, sep } from 'node:path'
import { compliancePackFiles, internalComplianceDocuments } from '../../utils/complianceTracker'
import { isSupabaseConfigured, serverSupabase } from '../../utils/supabase'

const bucketId = 'rex-compliance-evidence'
const allowedExtensions = new Set(['.docx', '.md', '.png', '.jpg', '.jpeg', '.webp', '.pdf', '.txt'])

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

const documentIdByFolder = Object.fromEntries(internalComplianceDocuments.map(document => [
  document.document_no.toString().padStart(2, '0'),
  document.id
]))

async function listEvidenceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = `${directory}\\${entry.name}`
    if (entry.isDirectory() && entry.name === 'Word Documents') return []
    if (entry.isDirectory()) return listEvidenceFiles(fullPath)
    if (!entry.isFile()) return []
    return shouldImportFile(fullPath) ? [fullPath] : []
  }))

  return nested.flat()
}

function shouldImportFile(filePath: string) {
  const extension = extname(filePath).toLowerCase()
  const filename = basename(filePath)
  const relativePath = relative(compliancePackFiles.root, filePath)
  const isRootFile = !relativePath.includes(sep)

  if (!allowedExtensions.has(extension)) return false
  if (!isRootFile) return true
  if (filename === 'README.md') return true
  if (filename === 'Data Flow for Rex app.png') return true
  if (filename === 'RexApp Go-Live Compliance Pack - Full Updated.docx') return true

  return false
}

function documentIdForPath(filePath: string) {
  const relativePath = relative(compliancePackFiles.root, filePath)
  const filename = basename(filePath)

  if (filename === 'Data Flow for Rex app.png') return '01-data-flow-diagram'

  const firstSegment = relativePath.split(sep)[0] || ''
  const segmentMatch = firstSegment.match(/^(\d{2})\b/)
  if (segmentMatch) return documentIdByFolder[segmentMatch[1]!] ?? '00-pack-index'

  const filenameMatch = filename.match(/^(\d{2})\b/)
  if (filenameMatch) return documentIdByFolder[filenameMatch[1]!] ?? '00-pack-index'

  return '00-pack-index'
}

function storagePathForFile(filePath: string) {
  const documentId = documentIdForPath(filePath)
  const relativePath = relative(compliancePackFiles.root, filePath)
    .split(sep)
    .map(segment => segment.replace(/[^a-zA-Z0-9._ -]+/g, '-').replace(/\s+/g, '-'))
    .join('/')

  return {
    documentId,
    storagePath: `${documentId}/source/${relativePath}`
  }
}

export default eventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    const files = await listEvidenceFiles(compliancePackFiles.root)
    return {
      imported: files.length,
      simulated: true
    }
  }

  const user = await serverSupabaseUser(event)
  const supabase = serverSupabase()

  const documentRows = internalComplianceDocuments.map(document => ({
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

  const seed = await supabase
    .from('internal_compliance_documents')
    .upsert(documentRows, { onConflict: 'id', ignoreDuplicates: true })

  if (seed.error) {
    throw createError({ statusCode: 500, statusMessage: seed.error.message })
  }

  const files = await listEvidenceFiles(compliancePackFiles.root)
  let imported = 0

  for (const filePath of files) {
    const { documentId, storagePath } = storagePathForFile(filePath)
    const fileBuffer = await readFile(filePath)
    const fileStats = await stat(filePath)
    const extension = extname(filePath).toLowerCase()

    const upload = await supabase.storage
      .from(bucketId)
      .upload(storagePath, fileBuffer, {
        contentType: contentTypes[extension] || 'application/octet-stream',
        upsert: true
      })

    if (upload.error) {
      throw createError({ statusCode: 500, statusMessage: upload.error.message })
    }

    const record = await supabase
      .from('internal_compliance_evidence_files')
      .upsert({
        document_id: documentId,
        bucket_id: bucketId,
        storage_path: storagePath,
        original_filename: filePath.split('\\').pop() || storagePath,
        content_type: contentTypes[extension] || 'application/octet-stream',
        size_bytes: fileStats.size,
        evidence_type: 'source_document',
        notes: `Imported from ${filePath}`,
        uploaded_by: user?.id ?? null
      }, { onConflict: 'storage_path' })

    if (record.error) {
      throw createError({ statusCode: 500, statusMessage: record.error.message })
    }

    imported += 1
  }

  return {
    imported
  }
})
