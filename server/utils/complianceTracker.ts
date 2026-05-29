export type ComplianceDocumentStatus = 'not_started' | 'draft' | 'evidence_pending' | 'ready_for_review' | 'approved' | 'blocked'

export interface InternalComplianceDocumentSeed {
  id: string
  document_no: number
  title: string
  source_status: string
  document_status: ComplianceDocumentStatus
  owner: string
  due_date: string
  evidence_required: string
  residual_risk: string
  go_live_blocker: boolean
  section_path: string
  markdown_path: string
  word_path: string
  sort_order: number
}

const complianceRoot = 'C:\\Users\\Dan\\Desktop\\Rex App Compliance'

function sectionPath(folder: string) {
  return `${complianceRoot}\\${folder}`
}

function markdownPath(folder: string, file: string) {
  return `${sectionPath(folder)}\\${file}`
}

function wordPath(folder: string, title: string) {
  return `${sectionPath(folder)}\\${title}.docx`
}

export const internalComplianceDocuments: InternalComplianceDocumentSeed[] = [{
  id: '00-pack-index',
  document_no: 0,
  title: 'Full compliance pack and evidence index',
  source_status: 'Working pack for practice/DPO review',
  document_status: 'ready_for_review',
  owner: 'Dan',
  due_date: '2026-06-03',
  evidence_required: 'README, full updated Word pack, source folder index, and current immediate go-live evidence gap list.',
  residual_risk: 'The evidence pack may drift from the app tracker if root documents are not imported after each pack update.',
  go_live_blocker: false,
  section_path: complianceRoot,
  markdown_path: `${complianceRoot}\\README.md`,
  word_path: `${complianceRoot}\\RexApp Go-Live Compliance Pack - Full Updated.docx`,
  sort_order: 0
}, {
  id: '01-data-flow-diagram',
  document_no: 1,
  title: 'Data flow diagram',
  source_status: 'Drafted',
  document_status: 'ready_for_review',
  owner: 'Technical owner',
  due_date: '2026-06-03',
  evidence_required: 'Confirm the current data-flow diagram matches production hosting, CRM support flow, processors, and third-party messaging/payment paths.',
  residual_risk: 'Low, provided the diagram is reviewed after production services and processors are finalised.',
  go_live_blocker: false,
  section_path: sectionPath('01 Data Flow Diagram'),
  markdown_path: markdownPath('01 Data Flow Diagram', 'data-flow-diagram.md'),
  word_path: wordPath('01 Data Flow Diagram', '01 Data Flow Diagram'),
  sort_order: 1
}, {
  id: '02-controller-processor-subprocessor-map',
  document_no: 2,
  title: 'Controller / processor / subprocessor map',
  source_status: 'Drafted',
  document_status: 'draft',
  owner: 'DPO/IG reviewer',
  due_date: '2026-06-05',
  evidence_required: 'Confirm controller/processor roles, enabled suppliers, support access, and DPA/contract status for every processing route.',
  residual_risk: 'Supplier role or transfer assumptions may be wrong until reviewed against the final production processor set.',
  go_live_blocker: true,
  section_path: sectionPath('02 Controller Processor Subprocessor Map'),
  markdown_path: markdownPath('02 Controller Processor Subprocessor Map', 'controller-processor-map.md'),
  word_path: wordPath('02 Controller Processor Subprocessor Map', '02 Controller Processor Subprocessor Map'),
  sort_order: 2
}, {
  id: '03-rexapp-customer-dpa-template',
  document_no: 3,
  title: 'RexApp customer DPA template',
  source_status: 'Draft starter',
  document_status: 'draft',
  owner: 'Commercial owner',
  due_date: '2026-06-07',
  evidence_required: 'Legal/commercial review of controller instructions, subprocessors, security measures, incident notification, retention, and signature route.',
  residual_risk: 'Customer processing may start without complete contractual processor terms if this remains only a starter template.',
  go_live_blocker: true,
  section_path: sectionPath('03 RexApp Customer DPA Template'),
  markdown_path: markdownPath('03 RexApp Customer DPA Template', 'rexapp-customer-dpa-template.md'),
  word_path: wordPath('03 RexApp Customer DPA Template', '03 RexApp Customer DPA Template'),
  sort_order: 3
}, {
  id: '04-supabase-dpa-uk-addendum-tia',
  document_no: 4,
  title: 'Supabase DPA, UK Addendum and TIA',
  source_status: 'Evidence checklist',
  document_status: 'evidence_pending',
  owner: 'Practice/admin',
  due_date: '2026-06-05',
  evidence_required: 'Signed or accepted Supabase DPA, UK Addendum/TIA review note, production region confirmation, backup/PITR evidence, and subprocessor review.',
  residual_risk: 'International transfer and processor contract risk remains open until the current Supabase legal evidence is accepted and reviewed.',
  go_live_blocker: true,
  section_path: sectionPath('04 Supabase DPA UK Addendum and TIA'),
  markdown_path: markdownPath('04 Supabase DPA UK Addendum and TIA', 'supabase-dpa-uk-addendum-tia.md'),
  word_path: wordPath('04 Supabase DPA UK Addendum and TIA', '04 Supabase DPA UK Addendum and TIA'),
  sort_order: 4
}, {
  id: '05-subprocessor-register',
  document_no: 5,
  title: 'Subprocessor register',
  source_status: 'Draft register',
  document_status: 'draft',
  owner: 'DPO/IG reviewer',
  due_date: '2026-06-07',
  evidence_required: 'Complete enabled processors and operational suppliers with purpose, data categories, region/transfer status, DPA/contract status, and go-live status.',
  residual_risk: 'Unapproved or unmapped subprocessors could process patient, staff, payment, or support data without adequate review.',
  go_live_blocker: true,
  section_path: sectionPath('05 Subprocessor Register'),
  markdown_path: markdownPath('05 Subprocessor Register', 'subprocessor-register.md'),
  word_path: wordPath('05 Subprocessor Register', '05 Subprocessor Register'),
  sort_order: 5
}, {
  id: '06-dpia',
  document_no: 6,
  title: 'DPIA',
  source_status: 'Draft adapted from Rex pilot DPIA',
  document_status: 'draft',
  owner: 'DPO/IG reviewer',
  due_date: '2026-06-10',
  evidence_required: 'Review lawful basis, special-category condition, mandatory actions, risk assessment, residual risk, and final DPIA decision.',
  residual_risk: 'DPIA risks are not accepted until the practice/DPO records the decision and mandatory pre-live actions.',
  go_live_blocker: true,
  section_path: sectionPath('06 DPIA'),
  markdown_path: markdownPath('06 DPIA', 'dpia.md'),
  word_path: wordPath('06 DPIA', '06 DPIA'),
  sort_order: 6
}, {
  id: '07-rls-rbac-test-evidence',
  document_no: 7,
  title: 'RLS and RBAC test evidence',
  source_status: 'Staging evidence captured; production evidence still required',
  document_status: 'evidence_pending',
  owner: 'Technical owner',
  due_date: '2026-06-06',
  evidence_required: 'Run the repeatable evidence query against production, attach RLS/RBAC matrix, public RPC allowlist, user/role review, and security advisor disposition.',
  residual_risk: 'Staging evidence is strong, but production RLS/RBAC and function-grant posture is not yet proven.',
  go_live_blocker: true,
  section_path: sectionPath('07 RLS and RBAC Test Evidence'),
  markdown_path: markdownPath('07 RLS and RBAC Test Evidence', 'rls-rbac-test-evidence.md'),
  word_path: wordPath('07 RLS and RBAC Test Evidence', '07 RLS and RBAC Test Evidence'),
  sort_order: 7
}, {
  id: '08-mfa-configuration-evidence',
  document_no: 8,
  title: 'MFA configuration evidence',
  source_status: 'Evidence checklist',
  document_status: 'evidence_pending',
  owner: 'Practice/admin',
  due_date: '2026-06-04',
  evidence_required: 'Production Supabase admin MFA posture, RexApp high-privilege role review, leaver/dormant user check, and exception register.',
  residual_risk: 'Admin account compromise remains a high-impact risk until MFA and privileged access evidence is approved.',
  go_live_blocker: true,
  section_path: sectionPath('08 MFA Configuration Evidence'),
  markdown_path: markdownPath('08 MFA Configuration Evidence', 'mfa-configuration-evidence.md'),
  word_path: wordPath('08 MFA Configuration Evidence', '08 MFA Configuration Evidence'),
  sort_order: 8
}, {
  id: '09-audit-log-examples',
  document_no: 9,
  title: 'Audit log examples',
  source_status: 'Staging evidence captured; redacted screenshots/exports required',
  document_status: 'evidence_pending',
  owner: 'Technical owner',
  due_date: '2026-06-08',
  evidence_required: 'Attach redacted production or approved staging examples for patient access, clinical change, permission change, communication, support ticket, and failed access events.',
  residual_risk: 'Auditability is evidenced by counts, but reviewer-friendly redacted examples are still needed.',
  go_live_blocker: false,
  section_path: sectionPath('09 Audit Log Examples'),
  markdown_path: markdownPath('09 Audit Log Examples', 'audit-log-examples.md'),
  word_path: wordPath('09 Audit Log Examples', '09 Audit Log Examples'),
  sort_order: 9
}, {
  id: '10-backup-restore-evidence',
  document_no: 10,
  title: 'Backup and restore evidence',
  source_status: 'Evidence checklist',
  document_status: 'evidence_pending',
  owner: 'Technical owner',
  due_date: '2026-06-05',
  evidence_required: 'Production backup/PITR settings, retention/plan evidence, restore-test record, RPO/RTO note, and named restore owner.',
  residual_risk: 'Patient and operational data recovery is unproven until production backup and restore evidence is captured.',
  go_live_blocker: true,
  section_path: sectionPath('10 Backup and Restore Evidence'),
  markdown_path: markdownPath('10 Backup and Restore Evidence', 'backup-restore-evidence.md'),
  word_path: wordPath('10 Backup and Restore Evidence', '10 Backup and Restore Evidence'),
  sort_order: 10
}, {
  id: '11-sms-email-minimisation-policy',
  document_no: 11,
  title: 'SMS/email minimisation policy',
  source_status: 'Draft policy',
  document_status: 'draft',
  owner: 'Clinical safety owner',
  due_date: '2026-06-07',
  evidence_required: 'Approve message-template allowlist and examples showing clinical notes, NHS numbers, DOBs, prescriptions, and excessive patient detail are excluded.',
  residual_risk: 'Outbound communications could disclose more patient data than needed without template approval and supplier review.',
  go_live_blocker: true,
  section_path: sectionPath('11 SMS Email Minimisation Policy'),
  markdown_path: markdownPath('11 SMS Email Minimisation Policy', 'sms-email-minimisation-policy.md'),
  word_path: wordPath('11 SMS Email Minimisation Policy', '11 SMS Email Minimisation Policy'),
  sort_order: 11
}, {
  id: '12-logging-support-ticket-policy',
  document_no: 12,
  title: 'Logging/support-ticket policy',
  source_status: 'Draft policy',
  document_status: 'draft',
  owner: 'Support owner',
  due_date: '2026-06-07',
  evidence_required: 'Approve CRM field list, redaction rules, retention period, authorised support visibility, urgent/security classification, and example support payload.',
  residual_risk: 'Support workflows may copy patient, clinical, payment, or staff-sensitive data into logs/tickets without clear controls.',
  go_live_blocker: true,
  section_path: sectionPath('12 Logging Support Ticket Policy'),
  markdown_path: markdownPath('12 Logging Support Ticket Policy', 'logging-support-ticket-policy.md'),
  word_path: wordPath('12 Logging Support Ticket Policy', '12 Logging Support Ticket Policy'),
  sort_order: 12
}, {
  id: '13-incident-response-process',
  document_no: 13,
  title: 'Incident response process',
  source_status: 'Draft process',
  document_status: 'draft',
  owner: 'Operations owner',
  due_date: '2026-06-10',
  evidence_required: 'Approve incident roles, severity triage, evidence sources, breach assessment route, ICO/NHS IG criteria, and tabletop outcome.',
  residual_risk: 'A real incident could be handled inconsistently until escalation paths and evidence preservation are rehearsed.',
  go_live_blocker: true,
  section_path: sectionPath('13 Incident Response Process'),
  markdown_path: markdownPath('13 Incident Response Process', 'incident-response-process.md'),
  word_path: wordPath('13 Incident Response Process', '13 Incident Response Process'),
  sort_order: 13
}, {
  id: '14-external-ig-dpo-review-note',
  document_no: 14,
  title: 'External IG/DPO review note',
  source_status: 'Review template',
  document_status: 'not_started',
  owner: 'External DPO/IG reviewer',
  due_date: '2026-06-12',
  evidence_required: 'Record external review findings, required pre-live actions, accepted residual risks, and explicit go-live opinion.',
  residual_risk: 'Independent UK GDPR/NHS IG assurance is missing until the review note is completed.',
  go_live_blocker: true,
  section_path: sectionPath('14 External IG DPO Review Note'),
  markdown_path: markdownPath('14 External IG DPO Review Note', 'external-ig-dpo-review-note.md'),
  word_path: wordPath('14 External IG DPO Review Note', '14 External IG DPO Review Note'),
  sort_order: 14
}, {
  id: '15-dspt-mapping',
  document_no: 15,
  title: 'DSPT mapping',
  source_status: 'Draft evidence map',
  document_status: 'draft',
  owner: 'DPO/IG reviewer',
  due_date: '2026-06-10',
  evidence_required: 'Update the DSPT map with production RLS/RBAC/MFA/audit/backup evidence, hosting processing statements, and residual risk decisions.',
  residual_risk: 'DSPT assurance remains incomplete while production evidence and external review outcomes are open.',
  go_live_blocker: true,
  section_path: sectionPath('15 DSPT Mapping'),
  markdown_path: markdownPath('15 DSPT Mapping', 'dspt-mapping.md'),
  word_path: wordPath('15 DSPT Mapping', '15 DSPT Mapping'),
  sort_order: 15
}, {
  id: '16-data-hosting-third-party-processing-statement',
  document_no: 16,
  title: 'Data hosting and third-party processing statement',
  source_status: 'Draft statement',
  document_status: 'draft',
  owner: 'DPO/IG reviewer',
  due_date: '2026-06-10',
  evidence_required: 'Confirm production hosting region, Supabase/AWS position, communications providers, payment/lab supplier status, support processing, and transfer safeguards.',
  residual_risk: 'Hosting and third-party processing wording may misstate the live operating model until production suppliers are confirmed.',
  go_live_blocker: true,
  section_path: sectionPath('16 Data Hosting and Third-Party Processing Statement'),
  markdown_path: markdownPath('16 Data Hosting and Third-Party Processing Statement', 'data-hosting-third-party-processing-statement.md'),
  word_path: wordPath('16 Data Hosting and Third-Party Processing Statement', '16 Data Hosting and Third-Party Processing Statement'),
  sort_order: 16
}]

export const compliancePackFiles = {
  root: complianceRoot,
  readme_path: `${complianceRoot}\\README.md`,
  data_flow_image_path: `${complianceRoot}\\Data Flow for Rex app.png`,
  full_pack_path: `${complianceRoot}\\RexApp Go-Live Compliance Pack - Full Updated.docx`
}
