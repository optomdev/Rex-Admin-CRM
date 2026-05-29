create table public.internal_compliance_documents (
  id text primary key,
  document_no integer not null,
  title text not null,
  source_status text not null,
  document_status text not null default 'not_started',
  owner text not null,
  due_date date,
  evidence_required text not null,
  residual_risk text not null,
  go_live_blocker boolean not null default true,
  source_folder_path text,
  source_markdown_path text,
  source_word_path text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_compliance_documents_document_status_check
    check (document_status in ('not_started', 'draft', 'evidence_pending', 'ready_for_review', 'approved', 'blocked'))
);

create table public.internal_compliance_evidence_files (
  id uuid primary key default gen_random_uuid(),
  document_id text not null references public.internal_compliance_documents(id) on delete cascade,
  bucket_id text not null default 'rex-compliance-evidence',
  storage_path text not null,
  original_filename text not null,
  content_type text,
  size_bytes bigint not null default 0,
  evidence_type text not null default 'supporting_evidence',
  notes text,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  constraint internal_compliance_evidence_storage_path_unique unique (storage_path),
  constraint internal_compliance_evidence_type_check
    check (evidence_type in ('source_document', 'supporting_evidence', 'review_note', 'screenshot', 'signed_approval'))
);

create index internal_compliance_documents_status_idx
  on public.internal_compliance_documents(document_status, go_live_blocker);

create index internal_compliance_evidence_document_idx
  on public.internal_compliance_evidence_files(document_id, uploaded_at desc);

create trigger internal_compliance_documents_set_updated_at
  before update on public.internal_compliance_documents
  for each row execute function public.set_updated_at();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'rex-compliance-evidence',
  'rex-compliance-evidence',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
) on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.internal_compliance_documents enable row level security;
alter table public.internal_compliance_evidence_files enable row level security;

create policy internal_compliance_documents_service_role_all
  on public.internal_compliance_documents
  for all to service_role
  using (true)
  with check (true);

create policy internal_compliance_evidence_files_service_role_all
  on public.internal_compliance_evidence_files
  for all to service_role
  using (true)
  with check (true);

create policy compliance_evidence_storage_service_role_all
  on storage.objects
  for all to service_role
  using (bucket_id = 'rex-compliance-evidence')
  with check (bucket_id = 'rex-compliance-evidence');

grant select, insert, update, delete on table
  public.internal_compliance_documents,
  public.internal_compliance_evidence_files
to service_role;

revoke all on table
  public.internal_compliance_documents,
  public.internal_compliance_evidence_files
from anon, authenticated;

insert into public.internal_compliance_documents (
  id,
  document_no,
  title,
  source_status,
  document_status,
  owner,
  due_date,
  evidence_required,
  residual_risk,
  go_live_blocker,
  source_folder_path,
  source_markdown_path,
  source_word_path,
  sort_order
) values
  ('00-pack-index', 0, 'Full compliance pack and evidence index', 'Working pack for practice/DPO review', 'ready_for_review', 'Dan', '2026-06-03', 'README, full updated Word pack, source folder index, and current immediate go-live evidence gap list.', 'The evidence pack may drift from the app tracker if root documents are not imported after each pack update.', false, 'C:\Users\Dan\Desktop\Rex App Compliance', 'C:\Users\Dan\Desktop\Rex App Compliance\README.md', 'C:\Users\Dan\Desktop\Rex App Compliance\RexApp Go-Live Compliance Pack - Full Updated.docx', 0),
  ('01-data-flow-diagram', 1, 'Data flow diagram', 'Drafted', 'ready_for_review', 'Technical owner', '2026-06-03', 'Confirm the current data-flow diagram matches production hosting, CRM support flow, processors, and third-party messaging/payment paths.', 'Low, provided the diagram is reviewed after production services and processors are finalised.', false, 'C:\Users\Dan\Desktop\Rex App Compliance\01 Data Flow Diagram', 'C:\Users\Dan\Desktop\Rex App Compliance\01 Data Flow Diagram\data-flow-diagram.md', 'C:\Users\Dan\Desktop\Rex App Compliance\01 Data Flow Diagram\01 Data Flow Diagram.docx', 1),
  ('02-controller-processor-subprocessor-map', 2, 'Controller / processor / subprocessor map', 'Drafted', 'draft', 'DPO/IG reviewer', '2026-06-05', 'Confirm controller/processor roles, enabled suppliers, support access, and DPA/contract status for every processing route.', 'Supplier role or transfer assumptions may be wrong until reviewed against the final production processor set.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\02 Controller Processor Subprocessor Map', 'C:\Users\Dan\Desktop\Rex App Compliance\02 Controller Processor Subprocessor Map\controller-processor-map.md', 'C:\Users\Dan\Desktop\Rex App Compliance\02 Controller Processor Subprocessor Map\02 Controller Processor Subprocessor Map.docx', 2),
  ('03-rexapp-customer-dpa-template', 3, 'RexApp customer DPA template', 'Draft starter', 'draft', 'Commercial owner', '2026-06-07', 'Legal/commercial review of controller instructions, subprocessors, security measures, incident notification, retention, and signature route.', 'Customer processing may start without complete contractual processor terms if this remains only a starter template.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\03 RexApp Customer DPA Template', 'C:\Users\Dan\Desktop\Rex App Compliance\03 RexApp Customer DPA Template\rexapp-customer-dpa-template.md', 'C:\Users\Dan\Desktop\Rex App Compliance\03 RexApp Customer DPA Template\03 RexApp Customer DPA Template.docx', 3),
  ('04-supabase-dpa-uk-addendum-tia', 4, 'Supabase DPA, UK Addendum and TIA', 'Evidence checklist', 'evidence_pending', 'Practice/admin', '2026-06-05', 'Signed or accepted Supabase DPA, UK Addendum/TIA review note, production region confirmation, backup/PITR evidence, and subprocessor review.', 'International transfer and processor contract risk remains open until the current Supabase legal evidence is accepted and reviewed.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\04 Supabase DPA UK Addendum and TIA', 'C:\Users\Dan\Desktop\Rex App Compliance\04 Supabase DPA UK Addendum and TIA\supabase-dpa-uk-addendum-tia.md', 'C:\Users\Dan\Desktop\Rex App Compliance\04 Supabase DPA UK Addendum and TIA\04 Supabase DPA UK Addendum and TIA.docx', 4),
  ('05-subprocessor-register', 5, 'Subprocessor register', 'Draft register', 'draft', 'DPO/IG reviewer', '2026-06-07', 'Complete enabled processors and operational suppliers with purpose, data categories, region/transfer status, DPA/contract status, and go-live status.', 'Unapproved or unmapped subprocessors could process patient, staff, payment, or support data without adequate review.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\05 Subprocessor Register', 'C:\Users\Dan\Desktop\Rex App Compliance\05 Subprocessor Register\subprocessor-register.md', 'C:\Users\Dan\Desktop\Rex App Compliance\05 Subprocessor Register\05 Subprocessor Register.docx', 5),
  ('06-dpia', 6, 'DPIA', 'Draft adapted from Rex pilot DPIA', 'draft', 'DPO/IG reviewer', '2026-06-10', 'Review lawful basis, special-category condition, mandatory actions, risk assessment, residual risk, and final DPIA decision.', 'DPIA risks are not accepted until the practice/DPO records the decision and mandatory pre-live actions.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\06 DPIA', 'C:\Users\Dan\Desktop\Rex App Compliance\06 DPIA\dpia.md', 'C:\Users\Dan\Desktop\Rex App Compliance\06 DPIA\06 DPIA.docx', 6),
  ('07-rls-rbac-test-evidence', 7, 'RLS and RBAC test evidence', 'Staging evidence captured; production evidence still required', 'evidence_pending', 'Technical owner', '2026-06-06', 'Run the repeatable evidence query against production, attach RLS/RBAC matrix, public RPC allowlist, user/role review, and security advisor disposition.', 'Staging evidence is strong, but production RLS/RBAC and function-grant posture is not yet proven.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\07 RLS and RBAC Test Evidence', 'C:\Users\Dan\Desktop\Rex App Compliance\07 RLS and RBAC Test Evidence\rls-rbac-test-evidence.md', 'C:\Users\Dan\Desktop\Rex App Compliance\07 RLS and RBAC Test Evidence\07 RLS and RBAC Test Evidence.docx', 7),
  ('08-mfa-configuration-evidence', 8, 'MFA configuration evidence', 'Evidence checklist', 'evidence_pending', 'Practice/admin', '2026-06-04', 'Production Supabase admin MFA posture, RexApp high-privilege role review, leaver/dormant user check, and exception register.', 'Admin account compromise remains a high-impact risk until MFA and privileged access evidence is approved.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\08 MFA Configuration Evidence', 'C:\Users\Dan\Desktop\Rex App Compliance\08 MFA Configuration Evidence\mfa-configuration-evidence.md', 'C:\Users\Dan\Desktop\Rex App Compliance\08 MFA Configuration Evidence\08 MFA Configuration Evidence.docx', 8),
  ('09-audit-log-examples', 9, 'Audit log examples', 'Staging evidence captured; redacted screenshots/exports required', 'evidence_pending', 'Technical owner', '2026-06-08', 'Attach redacted production or approved staging examples for patient access, clinical change, permission change, communication, support ticket, and failed access events.', 'Auditability is evidenced by counts, but reviewer-friendly redacted examples are still needed.', false, 'C:\Users\Dan\Desktop\Rex App Compliance\09 Audit Log Examples', 'C:\Users\Dan\Desktop\Rex App Compliance\09 Audit Log Examples\audit-log-examples.md', 'C:\Users\Dan\Desktop\Rex App Compliance\09 Audit Log Examples\09 Audit Log Examples.docx', 9),
  ('10-backup-restore-evidence', 10, 'Backup and restore evidence', 'Evidence checklist', 'evidence_pending', 'Technical owner', '2026-06-05', 'Production backup/PITR settings, retention/plan evidence, restore-test record, RPO/RTO note, and named restore owner.', 'Patient and operational data recovery is unproven until production backup and restore evidence is captured.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\10 Backup and Restore Evidence', 'C:\Users\Dan\Desktop\Rex App Compliance\10 Backup and Restore Evidence\backup-restore-evidence.md', 'C:\Users\Dan\Desktop\Rex App Compliance\10 Backup and Restore Evidence\10 Backup and Restore Evidence.docx', 10),
  ('11-sms-email-minimisation-policy', 11, 'SMS/email minimisation policy', 'Draft policy', 'draft', 'Clinical safety owner', '2026-06-07', 'Approve message-template allowlist and examples showing clinical notes, NHS numbers, DOBs, prescriptions, and excessive patient detail are excluded.', 'Outbound communications could disclose more patient data than needed without template approval and supplier review.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\11 SMS Email Minimisation Policy', 'C:\Users\Dan\Desktop\Rex App Compliance\11 SMS Email Minimisation Policy\sms-email-minimisation-policy.md', 'C:\Users\Dan\Desktop\Rex App Compliance\11 SMS Email Minimisation Policy\11 SMS Email Minimisation Policy.docx', 11),
  ('12-logging-support-ticket-policy', 12, 'Logging/support-ticket policy', 'Draft policy', 'draft', 'Support owner', '2026-06-07', 'Approve CRM field list, redaction rules, retention period, authorised support visibility, urgent/security classification, and example support payload.', 'Support workflows may copy patient, clinical, payment, or staff-sensitive data into logs/tickets without clear controls.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\12 Logging Support Ticket Policy', 'C:\Users\Dan\Desktop\Rex App Compliance\12 Logging Support Ticket Policy\logging-support-ticket-policy.md', 'C:\Users\Dan\Desktop\Rex App Compliance\12 Logging Support Ticket Policy\12 Logging Support Ticket Policy.docx', 12),
  ('13-incident-response-process', 13, 'Incident response process', 'Draft process', 'draft', 'Operations owner', '2026-06-10', 'Approve incident roles, severity triage, evidence sources, breach assessment route, ICO/NHS IG criteria, and tabletop outcome.', 'A real incident could be handled inconsistently until escalation paths and evidence preservation are rehearsed.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\13 Incident Response Process', 'C:\Users\Dan\Desktop\Rex App Compliance\13 Incident Response Process\incident-response-process.md', 'C:\Users\Dan\Desktop\Rex App Compliance\13 Incident Response Process\13 Incident Response Process.docx', 13),
  ('14-external-ig-dpo-review-note', 14, 'External IG/DPO review note', 'Review template', 'not_started', 'External DPO/IG reviewer', '2026-06-12', 'Record external review findings, required pre-live actions, accepted residual risks, and explicit go-live opinion.', 'Independent UK GDPR/NHS IG assurance is missing until the review note is completed.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\14 External IG DPO Review Note', 'C:\Users\Dan\Desktop\Rex App Compliance\14 External IG DPO Review Note\external-ig-dpo-review-note.md', 'C:\Users\Dan\Desktop\Rex App Compliance\14 External IG DPO Review Note\14 External IG DPO Review Note.docx', 14),
  ('15-dspt-mapping', 15, 'DSPT mapping', 'Draft evidence map', 'draft', 'DPO/IG reviewer', '2026-06-10', 'Update the DSPT map with production RLS/RBAC/MFA/audit/backup evidence, hosting processing statements, and residual risk decisions.', 'DSPT assurance remains incomplete while production evidence and external review outcomes are open.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\15 DSPT Mapping', 'C:\Users\Dan\Desktop\Rex App Compliance\15 DSPT Mapping\dspt-mapping.md', 'C:\Users\Dan\Desktop\Rex App Compliance\15 DSPT Mapping\15 DSPT Mapping.docx', 15),
  ('16-data-hosting-third-party-processing-statement', 16, 'Data hosting and third-party processing statement', 'Draft statement', 'draft', 'DPO/IG reviewer', '2026-06-10', 'Confirm production hosting region, Supabase/AWS position, communications providers, payment/lab supplier status, support processing, and transfer safeguards.', 'Hosting and third-party processing wording may misstate the live operating model until production suppliers are confirmed.', true, 'C:\Users\Dan\Desktop\Rex App Compliance\16 Data Hosting and Third-Party Processing Statement', 'C:\Users\Dan\Desktop\Rex App Compliance\16 Data Hosting and Third-Party Processing Statement\data-hosting-third-party-processing-statement.md', 'C:\Users\Dan\Desktop\Rex App Compliance\16 Data Hosting and Third-Party Processing Statement\16 Data Hosting and Third-Party Processing Statement.docx', 16)
on conflict (id) do update set
  source_status = excluded.source_status,
  evidence_required = excluded.evidence_required,
  residual_risk = excluded.residual_risk,
  source_folder_path = excluded.source_folder_path,
  source_markdown_path = excluded.source_markdown_path,
  source_word_path = excluded.source_word_path,
  sort_order = excluded.sort_order;
