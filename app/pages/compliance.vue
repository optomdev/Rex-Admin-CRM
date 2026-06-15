<script setup lang="ts">
import type { ComplianceDocument, ComplianceDocumentStatus, ComplianceEvidenceFile, ComplianceEvidenceType } from '~/types'

type EvidencePreview = {
  kind: 'text' | 'image' | 'download'
  filename: string
  content_type?: string | null
  signed_url?: string | null
  content?: string
  simulated?: boolean
}

const toast = useToast()
const detailOpen = ref(false)
const saving = ref(false)
const importing = ref(false)
const reimporting = ref(false)
const previewLoading = ref(false)
const uploadingDocumentId = ref<string | null>(null)
const selectedDocument = ref<ComplianceDocument | null>(null)
const selectedPreviewFile = ref<ComplianceEvidenceFile | null>(null)
const preview = ref<EvidencePreview | null>(null)

const { data: documents, status, refresh } = await useAsyncData<ComplianceDocument[]>('internal-compliance', () => $fetch('/api/compliance'))

const documentStatuses: ComplianceDocumentStatus[] = ['not_started', 'draft', 'evidence_pending', 'ready_for_review', 'approved', 'blocked']
const evidenceTypes: ComplianceEvidenceType[] = ['source_document', 'supporting_evidence', 'review_note', 'screenshot', 'signed_approval']

const editState = reactive({
  document_status: 'draft' as ComplianceDocumentStatus,
  owner: '',
  due_date: '',
  evidence_required: '',
  residual_risk: '',
  go_live_blocker: true,
  notes: ''
})

const uploadState = reactive<Record<string, {
  evidence_type: ComplianceEvidenceType
  notes: string
}>>({})

const rows = computed(() => documents.value ?? [])

function statusColor(documentStatus: ComplianceDocumentStatus) {
  if (documentStatus === 'approved') return 'success'
  if (documentStatus === 'ready_for_review') return 'primary'
  if (documentStatus === 'blocked') return 'error'
  if (['draft', 'evidence_pending'].includes(documentStatus)) return 'warning'
  return 'neutral'
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ')
}

function formatDate(date?: string | null) {
  if (!date) return 'No date'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(date))
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function sortedFiles(documentRecord: ComplianceDocument) {
  return [...(documentRecord.files ?? [])].sort((a, b) => {
    if (a.evidence_type === b.evidence_type) {
      return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    }

    return a.evidence_type === 'source_document' ? -1 : 1
  })
}

function sourceFiles(documentRecord: ComplianceDocument) {
  return sortedFiles(documentRecord).filter(file => file.evidence_type === 'source_document')
}

function supportingFiles(documentRecord: ComplianceDocument) {
  return sortedFiles(documentRecord).filter(file => file.evidence_type !== 'source_document')
}

function fileIcon(file: ComplianceEvidenceFile) {
  if (file.content_type?.startsWith('image/')) return 'i-lucide-image'
  if (file.original_filename.endsWith('.md')) return 'i-lucide-file-text'
  if (file.original_filename.endsWith('.docx')) return 'i-lucide-file-type'
  return 'i-lucide-file'
}

function isMarkdownFile(file: ComplianceEvidenceFile) {
  return file.content_type?.startsWith('text/') || file.original_filename.toLowerCase().endsWith('.md')
}

function isImageFile(file: ComplianceEvidenceFile) {
  const filename = file.original_filename.toLowerCase()
  return file.content_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(filename)
}

function uploadForm(documentId: string) {
  if (!uploadState[documentId]) {
    uploadState[documentId] = {
      evidence_type: 'supporting_evidence',
      notes: ''
    }
  }

  return uploadState[documentId]!
}

function fileInputId(documentId: string) {
  return `compliance-file-${documentId}`
}

function pickFile(documentId: string) {
  document.getElementById(fileInputId(documentId))?.click()
}

function openDetail(documentRecord: ComplianceDocument, autoPreview = true) {
  selectedDocument.value = documentRecord
  editState.document_status = documentRecord.document_status
  editState.owner = documentRecord.owner
  editState.due_date = documentRecord.due_date || ''
  editState.evidence_required = documentRecord.evidence_required
  editState.residual_risk = documentRecord.residual_risk
  editState.go_live_blocker = documentRecord.go_live_blocker
  editState.notes = documentRecord.notes || ''
  detailOpen.value = true

  if (autoPreview) {
    void selectDefaultPreview(documentRecord)
  }
}

function openDocs(documentRecord: ComplianceDocument) {
  openDetail(documentRecord)
}

function openDocsAtFile(documentRecord: ComplianceDocument, file: ComplianceEvidenceFile) {
  openDetail(documentRecord, false)
  void previewEvidenceFile(file)
}

function preferredPreviewFile(documentRecord: ComplianceDocument) {
  const sources = sourceFiles(documentRecord)
  return sources.find(isMarkdownFile) ?? sources.find(isImageFile) ?? sources[0] ?? supportingFiles(documentRecord)[0] ?? null
}

async function selectDefaultPreview(documentRecord: ComplianceDocument) {
  const file = preferredPreviewFile(documentRecord)
  preview.value = null
  selectedPreviewFile.value = null

  if (file) {
    await previewEvidenceFile(file)
  }
}

async function saveDocument() {
  if (!selectedDocument.value) return
  saving.value = true

  try {
    const updated = await $fetch<ComplianceDocument>(`/api/compliance/${selectedDocument.value.id}`, {
      method: 'PATCH',
      body: {
        document_status: editState.document_status,
        owner: editState.owner,
        due_date: editState.due_date || null,
        evidence_required: editState.evidence_required,
        residual_risk: editState.residual_risk,
        go_live_blocker: editState.go_live_blocker,
        notes: editState.notes || null
      }
    })

    selectedDocument.value = updated
    await refresh()

    toast.add({
      title: 'Compliance record saved',
      description: `${updated.title} is now ${formatLabel(updated.document_status)}.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Could not save record',
      description: error instanceof Error ? error.message : 'The compliance record was not saved.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    saving.value = false
  }
}

async function uploadEvidence(documentRecord: ComplianceDocument, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return

  uploadingDocumentId.value = documentRecord.id

  try {
    const form = uploadForm(documentRecord.id)
    const body = new FormData()
    body.append('file', file)
    body.append('evidence_type', form.evidence_type)
    body.append('notes', form.notes)

    await $fetch<ComplianceEvidenceFile>(`/api/compliance/${documentRecord.id}/files`, {
      method: 'POST',
      body
    })

    form.notes = ''
    await refresh()

    toast.add({
      title: 'Evidence uploaded',
      description: `${file.name} was stored in the private compliance bucket.`,
      color: 'success',
      icon: 'i-lucide-upload'
    })
  } catch (error) {
    toast.add({
      title: 'Upload failed',
      description: error instanceof Error ? error.message : 'The evidence file was not uploaded.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    uploadingDocumentId.value = null
  }
}

async function importDesktopPack() {
  importing.value = true

  try {
    const result = await $fetch<{ imported: number, simulated?: boolean }>('/api/compliance/import-desktop', {
      method: 'POST'
    })

    await refresh()

    toast.add({
      title: result.simulated ? 'Desktop pack checked' : 'Desktop pack imported',
      description: `${result.imported} evidence files mapped into the internal tracker.`,
      color: result.simulated ? 'warning' : 'success',
      icon: 'i-lucide-folder-sync'
    })
  } catch (error) {
    toast.add({
      title: 'Import failed',
      description: error instanceof Error ? error.message : 'The Desktop compliance folder was not imported.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    importing.value = false
  }
}

async function reimportDesktopPack() {
  reimporting.value = true

  try {
    const cleaned = await $fetch<{ deleted: number, simulated?: boolean }>('/api/compliance/reimport-desktop', {
      method: 'POST'
    })
    const imported = await $fetch<{ imported: number, simulated?: boolean }>('/api/compliance/import-desktop', {
      method: 'POST'
    })

    await refresh()

    toast.add({
      title: cleaned.simulated || imported.simulated ? 'Desktop pack checked' : 'Desktop pack re-imported',
      description: `${cleaned.deleted} old source files removed, ${imported.imported} current files mapped.`,
      color: cleaned.simulated || imported.simulated ? 'warning' : 'success',
      icon: 'i-lucide-refresh-cw'
    })
  } catch (error) {
    toast.add({
      title: 'Re-import failed',
      description: error instanceof Error ? error.message : 'The Desktop compliance folder was not refreshed.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    reimporting.value = false
  }
}

async function openEvidenceFile(file: ComplianceEvidenceFile) {
  try {
    const result = await $fetch<{ signed_url: string | null }>(`/api/compliance/files/${file.id}/signed-url`)

    if (result.signed_url) {
      window.open(result.signed_url, '_blank', 'noopener')
    }
  } catch (error) {
    toast.add({
      title: 'Could not open evidence',
      description: error instanceof Error ? error.message : 'A private signed URL could not be created.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  }
}

function openSelectedPreviewFile() {
  if (selectedPreviewFile.value) {
    void openEvidenceFile(selectedPreviewFile.value)
  }
}

async function previewEvidenceFile(file: ComplianceEvidenceFile) {
  selectedPreviewFile.value = file
  previewLoading.value = true

  try {
    preview.value = await $fetch<EvidencePreview>(`/api/compliance/files/${file.id}/preview`)
  } catch (error) {
    preview.value = null
    toast.add({
      title: 'Could not preview evidence',
      description: error instanceof Error ? error.message : 'The private evidence file could not be previewed.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    previewLoading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="compliance">
    <template #header>
      <UDashboardNavbar title="Compliance">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-folder-sync"
            label="Import Desktop Pack"
            color="neutral"
            variant="outline"
            :loading="importing"
            @click="importDesktopPack"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            label="Re-import Sources"
            color="neutral"
            variant="outline"
            :loading="reimporting"
            @click="reimportDesktopPack"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="rounded-lg border border-primary/30 bg-primary/10 p-4">
        <div class="flex items-start gap-3">
          <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <UIcon name="i-lucide-lock-keyhole" class="size-4" />
          </div>
          <div class="min-w-0">
            <p class="font-medium text-highlighted">
              Internal RexApp Compliance Tracker
            </p>
            <p class="mt-1 text-sm leading-6 text-muted">
              Tracks the Desktop evidence pack as internal operational records, with private Supabase Storage uploads and service-role-only database access.
            </p>
          </div>
        </div>
      </div>

      <div class="mt-5 space-y-4">
        <UCard
          v-for="documentRecord in rows"
          :key="documentRecord.id"
          :ui="{ root: 'rounded-lg', body: 'p-4 sm:p-4' }"
        >
          <div class="grid gap-4 xl:grid-cols-[1fr_18rem] xl:items-start">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  :label="documentRecord.document_no.toString().padStart(2, '0')"
                  color="neutral"
                  variant="outline"
                />
                <UBadge
                  :label="formatLabel(documentRecord.document_status)"
                  :color="statusColor(documentRecord.document_status)"
                  variant="subtle"
                />
                <UBadge
                  :label="documentRecord.go_live_blocker ? 'Go-live blocker' : 'Non-blocker'"
                  :color="documentRecord.go_live_blocker ? 'warning' : 'neutral'"
                  variant="outline"
                />
              </div>

              <h2 class="mt-3 font-semibold text-highlighted">
                {{ documentRecord.title }}
              </h2>
              <p class="mt-1 text-sm text-muted">
                {{ documentRecord.source_status }}
              </p>

              <dl class="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt class="text-muted">
                    Owner
                  </dt>
                  <dd class="mt-1 text-highlighted">
                    {{ documentRecord.owner }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted">
                    Due
                  </dt>
                  <dd class="mt-1 text-highlighted">
                    {{ formatDate(documentRecord.due_date) }}
                  </dd>
                </div>
                <div class="md:col-span-2">
                  <dt class="text-muted">
                    Evidence Required
                  </dt>
                  <dd class="mt-1 text-highlighted">
                    {{ documentRecord.evidence_required }}
                  </dd>
                </div>
                <div class="md:col-span-2">
                  <dt class="text-muted">
                    Residual Risk
                  </dt>
                  <dd class="mt-1 text-highlighted">
                    {{ documentRecord.residual_risk }}
                  </dd>
                </div>
              </dl>
            </div>

            <div class="space-y-3 rounded-lg border border-default p-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm font-medium text-highlighted">Docs</span>
                <UBadge
                  :label="`${documentRecord.files?.length ?? 0} files`"
                  color="neutral"
                  variant="subtle"
                />
              </div>

              <USelect
                v-model="uploadForm(documentRecord.id).evidence_type"
                :items="evidenceTypes"
                class="w-full"
              />
              <UInput
                v-model="uploadForm(documentRecord.id).notes"
                placeholder="Upload note"
                class="w-full"
              />
              <input
                :id="fileInputId(documentRecord.id)"
                type="file"
                class="hidden"
                @change="uploadEvidence(documentRecord, $event)"
              >
              <div class="flex gap-2">
                <UButton
                  icon="i-lucide-folder-open"
                  label="Docs"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  @click="openDocs(documentRecord)"
                />
                <UButton
                  icon="i-lucide-upload"
                  label="Upload"
                  size="sm"
                  class="flex-1"
                  :loading="uploadingDocumentId === documentRecord.id"
                  @click="pickFile(documentRecord.id)"
                />
                <UButton
                  icon="i-lucide-pencil"
                  aria-label="Edit record"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  @click="openDetail(documentRecord)"
                />
              </div>

              <div v-if="sourceFiles(documentRecord).length" class="space-y-2">
                <button
                  v-for="file in sourceFiles(documentRecord).slice(0, 3)"
                  :key="file.id"
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-md border border-default px-2 py-2 text-left text-sm hover:bg-elevated"
                  @click="openDocsAtFile(documentRecord, file)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <UIcon :name="fileIcon(file)" class="size-4 shrink-0 text-muted" />
                    <span class="truncate text-highlighted">{{ file.original_filename }}</span>
                  </span>
                  <span class="shrink-0 text-xs text-muted">{{ formatBytes(file.size_bytes) }}</span>
                </button>
              </div>
            </div>
          </div>
        </UCard>

        <UAlert
          v-if="!rows.length && status !== 'pending'"
          icon="i-lucide-info"
          color="neutral"
          variant="subtle"
          title="No compliance records yet"
          description="Run the Desktop pack import to seed internal evidence records."
        />
      </div>

      <USlideover
        v-model:open="detailOpen"
        :title="selectedDocument?.title || 'Compliance record'"
        description="Internal evidence status, ownership, risk, and go-live classification"
        :ui="{ content: 'sm:max-w-3xl' }"
      >
        <template #body>
          <div v-if="selectedDocument" class="space-y-5">
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Document status">
                <USelect
                  v-model="editState.document_status"
                  :items="documentStatuses"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Owner">
                <UInput v-model="editState.owner" class="w-full" />
              </UFormField>

              <UFormField label="Due date">
                <UInput v-model="editState.due_date" type="date" class="w-full" />
              </UFormField>

              <div class="flex items-end">
                <UCheckbox v-model="editState.go_live_blocker" label="Go-live blocker" />
              </div>

              <UFormField label="Evidence required" class="sm:col-span-2">
                <UTextarea
                  v-model="editState.evidence_required"
                  :rows="4"
                  autoresize
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Residual risk" class="sm:col-span-2">
                <UTextarea
                  v-model="editState.residual_risk"
                  :rows="4"
                  autoresize
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Internal notes" class="sm:col-span-2">
                <UTextarea
                  v-model="editState.notes"
                  :rows="3"
                  autoresize
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="rounded-lg border border-default p-4">
              <p class="text-sm font-medium text-highlighted">
                Source folder
              </p>
              <p class="mt-2 break-all text-sm text-muted">
                {{ selectedDocument.source_folder_path }}
              </p>
              <p class="mt-2 break-all text-sm text-muted">
                {{ selectedDocument.source_word_path }}
              </p>
            </div>

            <div class="grid gap-4 lg:grid-cols-[17rem_1fr]">
              <div class="space-y-4">
                <div class="space-y-2">
                  <p class="text-sm font-medium text-highlighted">
                    Source documents
                  </p>
                  <button
                    v-for="file in sourceFiles(selectedDocument)"
                    :key="file.id"
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition"
                    :class="selectedPreviewFile?.id === file.id ? 'border-primary/40 bg-primary/10' : 'border-default hover:bg-elevated'"
                    @click="previewEvidenceFile(file)"
                  >
                    <span class="min-w-0">
                      <span class="flex min-w-0 items-center gap-2">
                        <UIcon :name="fileIcon(file)" class="size-4 shrink-0 text-muted" />
                        <span class="block truncate text-sm font-medium text-highlighted">{{ file.original_filename }}</span>
                      </span>
                      <span class="block text-xs text-muted">{{ formatLabel(file.evidence_type) }} - {{ formatBytes(file.size_bytes) }}</span>
                    </span>
                    <UIcon name="i-lucide-eye" class="size-4 shrink-0 text-muted" />
                  </button>
                  <UAlert
                    v-if="!sourceFiles(selectedDocument).length"
                    icon="i-lucide-info"
                    color="neutral"
                    variant="subtle"
                    title="No source documents uploaded"
                    description="Use Import Desktop Pack to pull the local evidence folder into the private Supabase bucket."
                  />
                </div>

                <div class="space-y-2">
                  <p class="text-sm font-medium text-highlighted">
                    Supporting evidence
                  </p>
                  <button
                    v-for="file in supportingFiles(selectedDocument)"
                    :key="file.id"
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition"
                    :class="selectedPreviewFile?.id === file.id ? 'border-primary/40 bg-primary/10' : 'border-default hover:bg-elevated'"
                    @click="previewEvidenceFile(file)"
                  >
                    <span class="min-w-0">
                      <span class="flex min-w-0 items-center gap-2">
                        <UIcon :name="fileIcon(file)" class="size-4 shrink-0 text-muted" />
                        <span class="block truncate text-sm font-medium text-highlighted">{{ file.original_filename }}</span>
                      </span>
                      <span class="block text-xs text-muted">{{ formatLabel(file.evidence_type) }} - {{ formatBytes(file.size_bytes) }}</span>
                    </span>
                    <UIcon name="i-lucide-eye" class="size-4 shrink-0 text-muted" />
                  </button>
                </div>
              </div>

              <div class="min-w-0 rounded-lg border border-default bg-muted/20">
                <div class="flex items-center justify-between gap-3 border-b border-default px-4 py-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-highlighted">
                      {{ selectedPreviewFile?.original_filename || 'Evidence preview' }}
                    </p>
                    <p v-if="selectedPreviewFile" class="text-xs text-muted">
                      {{ formatLabel(selectedPreviewFile.evidence_type) }} - {{ formatBytes(selectedPreviewFile.size_bytes) }}
                    </p>
                  </div>
                  <UButton
                    v-if="selectedPreviewFile"
                    icon="i-lucide-external-link"
                    aria-label="Open evidence externally"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    @click="openSelectedPreviewFile"
                  />
                </div>

                <div class="min-h-80 p-4">
                  <div v-if="previewLoading" class="flex min-h-72 items-center justify-center text-sm text-muted">
                    Loading secure preview...
                  </div>

                  <div v-else-if="preview?.kind === 'image' && preview.signed_url" class="flex min-h-72 items-start justify-center overflow-auto rounded-md bg-default p-3">
                    <img
                      :src="preview.signed_url"
                      :alt="preview.filename"
                      class="max-h-[34rem] max-w-full rounded border border-default object-contain"
                    >
                  </div>

                  <div v-else-if="preview?.kind === 'text'" class="max-h-[34rem] overflow-auto rounded-md bg-default p-4">
                    <pre class="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-highlighted">{{ preview.content }}</pre>
                  </div>

                  <div v-else-if="preview" class="flex min-h-72 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-default bg-default px-6 text-center">
                    <UIcon name="i-lucide-file-lock-2" class="size-8 text-muted" />
                    <div>
                      <p class="text-sm font-medium text-highlighted">
                        Stored securely in the evidence bucket
                      </p>
                      <p class="mt-1 text-sm text-muted">
                        Word documents are kept as private uploads. Open this file to review it in Word.
                      </p>
                    </div>
                    <UButton
                      v-if="selectedPreviewFile"
                      icon="i-lucide-external-link"
                      label="Open file"
                      color="neutral"
                      variant="outline"
                      @click="openSelectedPreviewFile"
                    />
                  </div>

                  <div v-else class="flex min-h-72 items-center justify-center rounded-md border border-dashed border-default bg-default px-6 text-center text-sm text-muted">
                    Select a source document or supporting evidence file to preview it here.
                  </div>
                </div>
              </div>
            </div>

            <div class="flex justify-end">
              <UButton
                icon="i-lucide-save"
                label="Save record"
                :loading="saving"
                @click="saveDocument"
              />
            </div>
          </div>
        </template>
      </USlideover>
    </template>
  </UDashboardPanel>
</template>
